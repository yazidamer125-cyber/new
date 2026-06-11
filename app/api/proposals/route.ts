import { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  proposalWorkers,
  jobOrders,
  workers,
  threads,
  notifications,
  organizations,
} from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { assertProposableWorkers } from "@/lib/db/guards";
import { proposalCreateSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Agency: proposals it sent. Office: proposals received on its job orders. */
export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();

  if (ctx.org.type === "source_agency") {
    const rows = await db.query.proposals.findMany({
      where: eq(proposals.agencyId, ctx.org.id),
      orderBy: desc(proposals.createdAt),
      with: { jobOrder: true, workers: true },
    });
    return json({ proposals: rows });
  }

  const own = await db
    .select({ id: jobOrders.id })
    .from(jobOrders)
    .where(eq(jobOrders.officeId, ctx.org.id));
  if (own.length === 0) return json({ proposals: [] });
  const rows = await db.query.proposals.findMany({
    where: inArray(
      proposals.jobOrderId,
      own.map((j) => j.id),
    ),
    orderBy: desc(proposals.createdAt),
    with: { jobOrder: true, workers: true, agency: { columns: { id: true, name: true, country: true } } },
  });
  return json({ proposals: rows });
});

/**
 * Agency submits a proposal. Workers must be own + consented + available
 * (assertProposableWorkers — the in-code constraint from the schema spec).
 */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== "source_agency") {
    throw new ApiError(403, "WRONG_ORG_TYPE", "Only source agencies submit proposals.");
  }
  const body = proposalCreateSchema.parse(await req.json());

  const jobOrder = await db.query.jobOrders.findFirst({
    where: and(eq(jobOrders.id, body.jobOrderId), eq(jobOrders.status, "open")),
  });
  if (!jobOrder) throw new ApiError(404, "NOT_FOUND", "Job order not found or no longer open.");

  const existing = await db.query.proposals.findFirst({
    where: and(eq(proposals.jobOrderId, jobOrder.id), eq(proposals.agencyId, ctx.org.id)),
  });
  if (existing) throw new ApiError(409, "ALREADY_PROPOSED", "You already submitted a proposal for this job order.");

  const validWorkers = await assertProposableWorkers(ctx.org.id, body.workerIds);

  const [proposal] = await db
    .insert(proposals)
    .values({ jobOrderId: jobOrder.id, agencyId: ctx.org.id, message: body.message ?? null, status: "pending" })
    .returning();
  await db.insert(proposalWorkers).values(
    validWorkers.map((w) => ({ proposalId: proposal.id, workerId: w.id, status: "proposed" as const })),
  );
  await db
    .update(workers)
    .set({ status: "proposed", updatedAt: new Date() })
    .where(
      inArray(
        workers.id,
        validWorkers.map((w) => w.id),
      ),
    );
  const [thread] = await db.insert(threads).values({ proposalId: proposal.id }).returning();

  const agency = await db.query.organizations.findFirst({ where: eq(organizations.id, ctx.org.id) });
  await db.insert(notifications).values({
    orgId: jobOrder.officeId,
    type: "proposal.received",
    title: "عرض جديد على أمر التوظيف",
    body: `وكالة ${agency?.name ?? ""} قدّمت ${validWorkers.length} مرشحًا`,
    link: `/job-orders/${jobOrder.id}`,
  });

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "proposal.created",
    entityType: "proposal",
    entityId: proposal.id,
    context: { jobOrderId: jobOrder.id, workerIds: validWorkers.map((w) => w.id) },
  });

  return json({ proposal: { ...proposal, threadId: thread.id } }, 201);
});
