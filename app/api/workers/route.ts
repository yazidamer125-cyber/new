import { NextRequest } from "next/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { workers, proposals, proposalWorkers, jobOrders } from "@/lib/db/schema";
import { requireVerifiedOrg } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { workerPublicView } from "@/lib/db/access";
import { workerUpsertSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List endpoint privacy (rule #1): an agency sees ONLY its own workers; an
 * office sees ONLY workers inside non-withdrawn proposals addressed to its
 * own job orders. There is no global worker listing, ever.
 */
export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  const statusFilter = req.nextUrl.searchParams.get("status");

  if (ctx.org.type === "source_agency") {
    const rows = await db
      .select()
      .from(workers)
      .where(
        and(
          eq(workers.agencyId, ctx.org.id),
          statusFilter ? eq(workers.status, statusFilter as (typeof workers.status.enumValues)[number]) : undefined,
        ),
      )
      .orderBy(desc(workers.updatedAt));
    return json({ workers: rows.map((w) => ({ ...w, hasConsent: Boolean(w.consentId) })) });
  }

  // recruitment_office: workers proposed to this office only.
  const proposed = await db
    .selectDistinct({ workerId: proposalWorkers.workerId })
    .from(proposalWorkers)
    .innerJoin(proposals, eq(proposalWorkers.proposalId, proposals.id))
    .innerJoin(jobOrders, eq(proposals.jobOrderId, jobOrders.id))
    .where(and(eq(jobOrders.officeId, ctx.org.id), ne(proposals.status, "withdrawn")));
  const ids = proposed.map((p) => p.workerId);
  if (ids.length === 0) return json({ workers: [] });
  const rows = await db.select().from(workers).where(inArray(workers.id, ids));
  return json({ workers: rows.map(workerPublicView) });
});

/** Create a worker draft (agency only). Drafts need no consent yet. */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== "source_agency") {
    return json({ error: { code: "WRONG_ORG_TYPE", message: "Only source agencies manage workers." } }, 403);
  }
  const body = workerUpsertSchema.parse(await req.json());
  const [row] = await db
    .insert(workers)
    .values({ ...body, agencyId: ctx.org.id, status: "draft" })
    .returning();
  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "worker.created",
    entityType: "worker",
    entityId: row.id,
  });
  return json({ worker: { ...row, hasConsent: false } }, 201);
});
