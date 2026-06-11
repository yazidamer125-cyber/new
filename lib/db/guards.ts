import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from ".";
import {
  workers,
  proposals,
  proposalWorkers,
  jobOrders,
  placements,
  type Worker,
  type WorkerStatus,
} from "./schema";

/**
 * Result of a worker visibility check. `context` records WHY access was
 * granted so the caller can write it to the audit log (rule #4).
 */
export type WorkerViewGrant =
  | { allowed: true; relation: "owner" }
  | { allowed: true; relation: "proposal"; proposalId: string; jobOrderId: string }
  | { allowed: true; relation: "placement"; placementId: string }
  | { allowed: false };

/**
 * THE single source of truth for cross-organization worker visibility
 * (product rule #1). Every API route and server component that returns a
 * worker row to a viewer outside the owning agency MUST go through this.
 *
 * A recruitment office may see a worker ONLY when:
 *  - the worker is attached to a non-withdrawn proposal targeting one of the
 *    office's own job orders, or
 *  - an active placement links the worker to the office.
 *
 * The owning agency always sees its own workers. Everyone else: nothing —
 * not even existence.
 */
export async function canViewWorker(viewerOrgId: string, workerId: string): Promise<WorkerViewGrant> {
  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, workerId),
    columns: { id: true, agencyId: true },
  });
  if (!worker) return { allowed: false };
  if (worker.agencyId === viewerOrgId) return { allowed: true, relation: "owner" };

  // Proposal path: worker is inside a proposal addressed to a job order
  // owned by the viewer's office.
  const proposalRow = await db
    .select({ proposalId: proposals.id, jobOrderId: proposals.jobOrderId })
    .from(proposalWorkers)
    .innerJoin(proposals, eq(proposalWorkers.proposalId, proposals.id))
    .innerJoin(jobOrders, eq(proposals.jobOrderId, jobOrders.id))
    .where(
      and(
        eq(proposalWorkers.workerId, workerId),
        eq(jobOrders.officeId, viewerOrgId),
        ne(proposals.status, "withdrawn"),
      ),
    )
    .limit(1);
  if (proposalRow.length > 0) {
    return {
      allowed: true,
      relation: "proposal",
      proposalId: proposalRow[0].proposalId,
      jobOrderId: proposalRow[0].jobOrderId,
    };
  }

  // Placement path: an established placement between the two organizations.
  const placementRow = await db
    .select({ id: placements.id })
    .from(placements)
    .where(and(eq(placements.workerId, workerId), eq(placements.officeId, viewerOrgId)))
    .limit(1);
  if (placementRow.length > 0) {
    return { allowed: true, relation: "placement", placementId: placementRow[0].id };
  }

  return { allowed: false };
}

/** Worker status transitions enforced in code (libSQL CHECK support is limited). */
const WORKER_TRANSITIONS: Record<WorkerStatus, WorkerStatus[]> = {
  draft: ["available"],
  available: ["proposed", "inactive", "draft"],
  proposed: ["available", "reserved", "inactive"],
  reserved: ["processing", "available"],
  processing: ["deployed", "available"],
  deployed: ["inactive"],
  inactive: ["available"],
};

export class GuardError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Rule #2: a worker may never leave 'draft' without a signed consent
 * document on file. Mirrored by the `workers_consent_required` CHECK in the
 * schema; this version produces a friendly, typed error.
 */
export function assertWorkerTransition(worker: Worker, next: WorkerStatus): void {
  if (worker.status === next) return;
  if (next !== "draft" && !worker.consentId) {
    throw new GuardError(
      "CONSENT_REQUIRED",
      "Worker cannot leave draft status without a signed consent document.",
    );
  }
  if (!WORKER_TRANSITIONS[worker.status].includes(next)) {
    throw new GuardError("INVALID_TRANSITION", `Cannot move worker from '${worker.status}' to '${next}'.`);
  }
}

/**
 * proposal_workers may only reference workers that (a) belong to the
 * proposing agency and (b) are currently 'available' or 'proposed' and
 * (c) carry a signed consent. Returns the validated worker rows.
 */
export async function assertProposableWorkers(agencyId: string, workerIds: string[]): Promise<Worker[]> {
  if (workerIds.length === 0) throw new GuardError("NO_WORKERS", "A proposal must include at least one worker.");
  const rows = await db
    .select()
    .from(workers)
    .where(and(inArray(workers.id, workerIds), eq(workers.agencyId, agencyId)));
  if (rows.length !== workerIds.length) {
    throw new GuardError("WORKER_NOT_OWNED", "One or more workers do not belong to your agency.");
  }
  for (const w of rows) {
    if (!w.consentId) {
      throw new GuardError("CONSENT_REQUIRED", `Worker ${w.fullName} has no signed consent on file.`);
    }
    if (w.status !== "available" && w.status !== "proposed") {
      throw new GuardError("WORKER_UNAVAILABLE", `Worker ${w.fullName} is not available (status: ${w.status}).`);
    }
  }
  return rows;
}
