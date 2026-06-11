import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type AuditEntry = {
  actorUserId?: string | null;
  actorOrgId?: string | null;
  action: string; // e.g. 'worker.viewed', 'proposal.created', 'org.verified'
  entityType: string;
  entityId: string;
  context?: Record<string, unknown>;
};

/**
 * Rule #4: full audit logging. Awaited (not fire-and-forget) so a failed
 * audit write fails the request — reads of worker data must never go
 * unrecorded.
 */
export async function logAction(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId ?? null,
    actorOrgId: entry.actorOrgId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    context: entry.context ?? null,
  });
}
