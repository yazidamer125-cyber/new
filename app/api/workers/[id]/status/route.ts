import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workers } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { assertWorkerTransition } from "@/lib/db/guards";
import { workerStatusSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manual status changes by the owning agency, guarded by assertWorkerTransition. */
export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, params.id) });
  if (!worker || worker.agencyId !== ctx.org.id) throw new ApiError(404, "NOT_FOUND", "Worker not found.");

  const { status } = workerStatusSchema.parse(await req.json());
  assertWorkerTransition(worker, status); // rule #2: blocks leaving draft without consent

  const [updated] = await db
    .update(workers)
    .set({ status, updatedAt: new Date() })
    .where(eq(workers.id, worker.id))
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "worker.status_changed",
    entityType: "worker",
    entityId: worker.id,
    context: { from: worker.status, to: status },
  });

  return json({ worker: { ...updated, hasConsent: Boolean(updated.consentId) } });
});
