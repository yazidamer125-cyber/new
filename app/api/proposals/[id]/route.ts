import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  proposalWorkers,
  jobOrders,
  workers,
  placements,
  notifications,
} from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError, type SessionContext } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { proposalStatusSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadProposalForParty(ctx: SessionContext & { org: NonNullable<SessionContext["org"]> }, id: string) {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, id),
    with: { jobOrder: true, workers: true },
  });
  if (!proposal) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  const isAgency = proposal.agencyId === ctx.org.id;
  const isOffice = proposal.jobOrder.officeId === ctx.org.id;
  if (!isAgency && !isOffice) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
  return { proposal, isAgency, isOffice };
}

export const GET = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const { proposal } = await loadProposalForParty(ctx, params.id);
  return json({ proposal });
});

/**
 * Status transitions. Office: shortlist / accept / reject (its job order).
 * Agency: withdraw. Accepting creates placements for the selected workers
 * (falling back to all non-rejected) and moves those workers to 'reserved'.
 */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const { proposal, isAgency, isOffice } = await loadProposalForParty(ctx, params.id);
  const { status } = proposalStatusSchema.parse(await req.json());

  const officeActions = ["shortlisted", "accepted", "rejected"];
  if (officeActions.includes(status) && !isOffice) {
    throw new ApiError(403, "FORBIDDEN", "Only the recruitment office can take this action.");
  }
  if (status === "withdrawn" && !isAgency) {
    throw new ApiError(403, "FORBIDDEN", "Only the proposing agency can withdraw.");
  }
  if (["accepted", "rejected", "withdrawn"].includes(proposal.status)) {
    throw new ApiError(409, "FINAL_STATE", `Proposal is already ${proposal.status}.`);
  }

  const [updated] = await db.update(proposals).set({ status }).where(eq(proposals.id, proposal.id)).returning();

  if (status === "accepted") {
    const selected = proposal.workers.filter((w) => w.status === "selected");
    const chosen = (selected.length > 0 ? selected : proposal.workers.filter((w) => w.status !== "rejected")).map(
      (w) => w.workerId,
    );
    if (chosen.length === 0) throw new ApiError(409, "NO_WORKERS", "No selectable workers on this proposal.");
    await db.insert(placements).values(
      chosen.map((workerId) => ({
        workerId,
        jobOrderId: proposal.jobOrderId,
        officeId: proposal.jobOrder.officeId,
        agencyId: proposal.agencyId,
        stage: "contract" as const,
      })),
    );
    await db
      .update(workers)
      .set({ status: "reserved", updatedAt: new Date() })
      .where(inArray(workers.id, chosen));
    await db
      .update(proposalWorkers)
      .set({ status: "selected" })
      .where(and(eq(proposalWorkers.proposalId, proposal.id), inArray(proposalWorkers.workerId, chosen)));
    await db.update(jobOrders).set({ status: "in_review" }).where(eq(jobOrders.id, proposal.jobOrderId));
  }

  if (status === "withdrawn") {
    const ids = proposal.workers.map((w) => w.workerId);
    if (ids.length > 0) {
      // Release workers that are not part of any other live proposal.
      await db
        .update(workers)
        .set({ status: "available", updatedAt: new Date() })
        .where(and(inArray(workers.id, ids), eq(workers.status, "proposed")));
    }
  }

  const counterpartOrgId = isOffice ? proposal.agencyId : proposal.jobOrder.officeId;
  await db.insert(notifications).values({
    orgId: counterpartOrgId,
    type: `proposal.${status}`,
    title:
      status === "shortlisted"
        ? "تم إدراج عرضك في القائمة المختصرة"
        : status === "accepted"
          ? "تم قبول عرضك"
          : status === "rejected"
            ? "تم رفض العرض"
            : "تم سحب العرض",
    link: `/proposals/${proposal.id}`,
  });

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: `proposal.${status}`,
    entityType: "proposal",
    entityId: proposal.id,
    context: { from: proposal.status, jobOrderId: proposal.jobOrderId },
  });

  return json({ proposal: updated });
});
