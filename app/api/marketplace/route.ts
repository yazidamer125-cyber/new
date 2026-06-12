import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  workers,
  organizations,
  jobOrders,
  proposals,
  proposalWorkers,
  threads,
  messages,
  notifications,
} from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { listMarketplaceForOffice } from "@/lib/db/marketplace";
import { marketplaceRequestSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Office: redacted cards of every available+consented worker across agencies. */
export const GET = withApi(async () => {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== "recruitment_office") {
    throw new ApiError(403, "WRONG_ORG_TYPE", "Only recruitment offices browse the marketplace.");
  }
  const cards = await listMarketplaceForOffice(ctx);
  return json({ workers: cards });
});

/**
 * Office picks a worker from the marketplace for one of its open job orders.
 * Reuses the proposal machinery (worker → 'proposed', thread, notification),
 * so canViewWorker(), audit logging and the accept→placement flow all apply
 * unchanged. If the agency already has a live proposal on that job order the
 * worker is appended to it (proposals are unique per job order + agency).
 */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== "recruitment_office") {
    throw new ApiError(403, "WRONG_ORG_TYPE", "Only recruitment offices request marketplace workers.");
  }
  const body = marketplaceRequestSchema.parse(await req.json());

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, body.workerId) });
  // 404 (not 403) so outsiders can't probe worker existence.
  if (!worker || !worker.consentId) throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  const agency = await db.query.organizations.findFirst({ where: eq(organizations.id, worker.agencyId) });
  if (!agency || agency.verificationStatus !== "verified") throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  if (worker.status !== "available") {
    throw new ApiError(409, "WORKER_UNAVAILABLE", "هذا المرشح لم يعد متاحًا — ربما حُجز للتو.");
  }

  const jobOrder = await db.query.jobOrders.findFirst({
    where: and(eq(jobOrders.id, body.jobOrderId), eq(jobOrders.officeId, ctx.org.id), eq(jobOrders.status, "open")),
  });
  if (!jobOrder) throw new ApiError(404, "NOT_FOUND", "أمر التوظيف غير موجود أو غير مفتوح.");

  // One proposal per (job order, agency): append to a live one when it exists.
  const existing = await db.query.proposals.findFirst({
    where: and(eq(proposals.jobOrderId, jobOrder.id), eq(proposals.agencyId, agency.id)),
  });

  let proposalId: string;
  if (existing) {
    if (!["pending", "shortlisted"].includes(existing.status)) {
      throw new ApiError(
        409,
        "PROPOSAL_CLOSED",
        "يوجد عرض سابق من هذه الوكالة على نفس الأمر وقد أُغلق — أنشئ أمر توظيف جديدًا.",
      );
    }
    const already = await db.query.proposalWorkers.findFirst({
      where: and(eq(proposalWorkers.proposalId, existing.id), eq(proposalWorkers.workerId, worker.id)),
    });
    if (already) throw new ApiError(409, "ALREADY_REQUESTED", "هذا المرشح مطلوب مسبقًا على هذا الأمر.");
    await db
      .insert(proposalWorkers)
      .values({ proposalId: existing.id, workerId: worker.id, status: "proposed" });
    proposalId = existing.id;
  } else {
    const [proposal] = await db
      .insert(proposals)
      .values({
        jobOrderId: jobOrder.id,
        agencyId: agency.id,
        status: "pending",
        message: "طلب مباشر من المكتب عبر سوق الكوادر",
      })
      .returning();
    await db.insert(proposalWorkers).values({ proposalId: proposal.id, workerId: worker.id, status: "proposed" });
    const [thread] = await db.insert(threads).values({ proposalId: proposal.id }).returning();
    await db.insert(messages).values({
      threadId: thread.id,
      senderUserId: ctx.user.id,
      body: body.message?.trim() || "اخترنا هذا المرشح من سوق الكوادر — نرجو تأكيد العرض.",
    });
    proposalId = proposal.id;
  }

  await db.update(workers).set({ status: "proposed", updatedAt: new Date() }).where(eq(workers.id, worker.id));

  // Office identity stays masked from the agency until shortlist (platform rule).
  await db.insert(notifications).values({
    orgId: agency.id,
    type: "marketplace.request",
    title: "طلب مرشح من سوق الكوادر",
    body: `مكتب موثّق (${ctx.org.country}) اختار «${worker.fullName}» — راجع العرض للمتابعة أو السحب.`,
    link: `/proposals/${proposalId}`,
  });

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "proposal.requested",
    entityType: "proposal",
    entityId: proposalId,
    context: { source: "marketplace", workerId: worker.id, jobOrderId: jobOrder.id, agencyId: agency.id },
  });

  return json({ proposalId, jobOrderId: jobOrder.id }, 201);
});
