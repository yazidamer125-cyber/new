import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workers } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { getViewableWorker, workerPublicView } from "@/lib/db/access";
import { workerUpsertSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single worker read. ALL access flows through getViewableWorker() →
 * canViewWorker(); cross-org reads are audit-logged with their proposal or
 * placement context (rules #1 and #4). Non-owners get the redacted view.
 */
export const GET = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const { worker, grant } = await getViewableWorker(ctx, params.id);
  if (grant.relation === "owner") {
    return json({ worker: { ...worker, hasConsent: Boolean(worker.consentId) }, relation: "owner" });
  }
  return json({ worker: workerPublicView(worker), relation: grant.relation });
});

/** Update own worker (agency only). */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const existing = await db.query.workers.findFirst({ where: eq(workers.id, params.id) });
  if (!existing || existing.agencyId !== ctx.org.id) {
    throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  }
  const body = workerUpsertSchema.partial().parse(await req.json());
  const [row] = await db
    .update(workers)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(workers.id, params.id))
    .returning();
  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "worker.updated",
    entityType: "worker",
    entityId: row.id,
    context: { fields: Object.keys(body) },
  });
  return json({ worker: { ...row, hasConsent: Boolean(row.consentId) } });
});

/** Delete is only allowed for drafts; everything else becomes 'inactive'. */
export const DELETE = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const existing = await db.query.workers.findFirst({ where: eq(workers.id, params.id) });
  if (!existing || existing.agencyId !== ctx.org.id) {
    throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  }
  if (existing.status !== "draft") {
    throw new ApiError(409, "NOT_DRAFT", "Only draft workers can be deleted. Set status to inactive instead.");
  }
  await db.delete(workers).where(eq(workers.id, params.id));
  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "worker.deleted",
    entityType: "worker",
    entityId: params.id,
  });
  return json({ ok: true });
});
