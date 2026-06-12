import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workers, consents } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { consentSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Attach a signed consent document (rule #2). The consent must reference an
 * uploaded R2 object under this org's prefix; until it exists the worker is
 * locked in 'draft' by both the API guard and the DB CHECK constraint.
 */
export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, params.id) });
  if (!worker || worker.agencyId !== ctx.org.id) throw new ApiError(404, "NOT_FOUND", "Worker not found.");

  const body = consentSchema.parse(await req.json());
  if (!body.docKey.startsWith(`org/${ctx.org.id}/`)) {
    throw new ApiError(403, "BAD_KEY", "Consent document key does not belong to your organization.");
  }

  const [consent] = await db
    .insert(consents)
    .values({ workerId: worker.id, docKey: body.docKey, signedDate: body.signedDate, scope: "share_b2b" })
    .returning();
  const [updated] = await db
    .update(workers)
    .set({ consentId: consent.id, updatedAt: new Date() })
    .where(eq(workers.id, worker.id))
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "worker.consent_attached",
    entityType: "worker",
    entityId: worker.id,
    context: { consentId: consent.id, signedDate: body.signedDate },
  });

  return json({ worker: { ...updated, hasConsent: true }, consent }, 201);
});
