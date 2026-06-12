import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { requireUser, ApiError } from "@/lib/auth/helpers";
import { canViewWorker } from "@/lib/db/guards";
import { logAction } from "@/lib/auth/audit";
import { signDownloadUrl, parseObjectKey, SIGNED_URL_TTL_SECONDS } from "@/lib/r2";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rule #5: the ONLY way any file leaves R2. Checks ownership/visibility,
 * then returns a 10-minute signed URL. Grant logic:
 *   - platform_admin: any key (license review, oversight) — always logged.
 *   - own org prefix: allowed.
 *   - cross-org worker files: only via canViewWorker() (proposal/placement),
 *     logged as 'worker.file_viewed' with the granting context.
 */
export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireUser();
  const key = req.nextUrl.searchParams.get("key");
  const fileName = req.nextUrl.searchParams.get("name") ?? undefined;
  if (!key) throw new ApiError(400, "MISSING_KEY", "Query parameter 'key' is required.");

  const parsed = parseObjectKey(key);
  if (!parsed) throw new ApiError(400, "BAD_KEY", "Malformed object key.");

  const isAdmin = ctx.user.role === "platform_admin";
  const isOwnOrg = ctx.org?.id === parsed.orgId;

  if (!isAdmin && !isOwnOrg) {
    if (!ctx.org) throw new ApiError(403, "FORBIDDEN", "Not allowed.");
    // Cross-org access is only possible for worker-scoped files, and only
    // through an active proposal/placement relation.
    let workerId = parsed.workerId;
    if (!workerId) {
      const doc = await db.query.documents.findFirst({ where: eq(documents.fileKey, key) });
      workerId = doc?.workerId ?? undefined;
    }
    if (!workerId) throw new ApiError(404, "NOT_FOUND", "File not found.");
    const grant = await canViewWorker(ctx.org.id, workerId);
    if (!grant.allowed) throw new ApiError(404, "NOT_FOUND", "File not found.");
    await logAction({
      actorUserId: ctx.user.id,
      actorOrgId: ctx.org.id,
      action: "worker.file_viewed",
      entityType: "worker",
      entityId: workerId,
      context: {
        key,
        ...(grant.relation === "proposal"
          ? { relation: "proposal", proposalId: grant.proposalId }
          : grant.relation === "placement"
            ? { relation: "placement", placementId: grant.placementId }
            : { relation: grant.relation }),
      },
    });
  } else if (isAdmin && !isOwnOrg) {
    await logAction({
      actorUserId: ctx.user.id,
      actorOrgId: null,
      action: "file.admin_viewed",
      entityType: "file",
      entityId: key,
    });
  }

  const url = await signDownloadUrl(key, fileName);
  return json({ url, expiresIn: SIGNED_URL_TTL_SECONDS });
});
