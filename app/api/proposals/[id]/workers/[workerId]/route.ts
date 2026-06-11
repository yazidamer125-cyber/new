import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalWorkers } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { proposalWorkerStatusSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Office marks individual candidates inside a proposal: selected / rejected. */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, params.id),
    with: { jobOrder: true },
  });
  if (!proposal || proposal.jobOrder.officeId !== ctx.org.id) {
    throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  }
  if (["accepted", "rejected", "withdrawn"].includes(proposal.status)) {
    throw new ApiError(409, "FINAL_STATE", "Proposal is closed.");
  }

  const { status } = proposalWorkerStatusSchema.parse(await req.json());
  const [row] = await db
    .update(proposalWorkers)
    .set({ status })
    .where(and(eq(proposalWorkers.proposalId, params.id), eq(proposalWorkers.workerId, params.workerId)))
    .returning();
  if (!row) throw new ApiError(404, "NOT_FOUND", "Worker is not part of this proposal.");

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "proposal.worker_marked",
    entityType: "proposal",
    entityId: params.id,
    context: { workerId: params.workerId, status },
  });

  return json({ proposalWorker: row });
});
