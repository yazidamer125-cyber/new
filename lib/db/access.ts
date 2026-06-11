import { eq } from "drizzle-orm";
import { db } from ".";
import { workers, consents, type Worker } from "./schema";
import { canViewWorker, type WorkerViewGrant } from "./guards";
import { logAction } from "@/lib/auth/audit";
import { ApiError, type SessionContext } from "@/lib/auth/helpers";

export type ViewableWorker = {
  worker: Worker & { consentSignedDate: string | null };
  grant: Extract<WorkerViewGrant, { allowed: true }>;
};

/**
 * The ONLY sanctioned path for reading a single worker row (API routes and
 * server components alike). Wraps canViewWorker() and writes the mandatory
 * 'worker.viewed' audit entry for every cross-org read, including the
 * proposal/placement context that granted access (rules #1 and #4).
 */
export async function getViewableWorker(ctx: SessionContext, workerId: string): Promise<ViewableWorker> {
  if (!ctx.org) throw new ApiError(403, "NO_ORG", "No organization context.");
  const grant = await canViewWorker(ctx.org.id, workerId);
  if (!grant.allowed) {
    // 404, not 403: outsiders must not learn that the worker exists.
    throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  }
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) throw new ApiError(404, "NOT_FOUND", "Worker not found.");

  let consentSignedDate: string | null = null;
  if (worker.consentId) {
    const consent = await db.query.consents.findFirst({ where: eq(consents.id, worker.consentId) });
    consentSignedDate = consent?.signedDate ?? null;
  }

  if (grant.relation !== "owner") {
    await logAction({
      actorUserId: ctx.user.id,
      actorOrgId: ctx.org.id,
      action: "worker.viewed",
      entityType: "worker",
      entityId: workerId,
      context:
        grant.relation === "proposal"
          ? { relation: "proposal", proposalId: grant.proposalId, jobOrderId: grant.jobOrderId }
          : { relation: "placement", placementId: grant.placementId },
    });
  }

  return { worker: { ...worker, consentSignedDate }, grant };
}

/** Fields of a worker that a counterpart office is allowed to see. */
export function workerPublicView(w: Worker & { consentSignedDate?: string | null }) {
  return {
    id: w.id,
    fullName: w.fullName,
    dob: w.dob,
    nationality: w.nationality,
    position: w.position,
    experienceYears: w.experienceYears,
    languages: w.languages,
    skills: w.skills,
    salaryExpectation: w.salaryExpectation,
    photoKey: w.photoKey,
    videoKey: w.videoKey,
    status: w.status,
    hasConsent: Boolean(w.consentId),
    consentSignedDate: w.consentSignedDate ?? null,
    // passportNo deliberately omitted from cross-org view until placement stage.
  };
}
