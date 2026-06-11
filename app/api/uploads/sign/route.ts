import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workers } from "@/lib/db/schema";
import { requireUser, ApiError } from "@/lib/auth/helpers";
import { signUploadUrl, buildObjectKey, UPLOAD_KINDS, SIGNED_URL_TTL_SECONDS } from "@/lib/r2";
import { uploadSignSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a 10-minute signed PUT URL for direct browser → R2 uploads. Keys
 * are always scoped to the caller's org. License uploads are allowed while
 * still pending verification (it's part of onboarding); everything else
 * requires a verified org implicitly because the referenced worker must
 * belong to the caller.
 */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireUser();
  if (!ctx.org) throw new ApiError(403, "NO_ORG", "No organization context.");
  const body = uploadSignSchema.parse(await req.json());

  const kind = UPLOAD_KINDS[body.kind];
  if (!(kind.contentTypes as readonly string[]).includes(body.contentType)) {
    throw new ApiError(415, "BAD_CONTENT_TYPE", `Content type not allowed for ${body.kind}.`);
  }

  if (kind.needsWorker || body.workerId) {
    if (!body.workerId) throw new ApiError(400, "WORKER_REQUIRED", "workerId is required for this upload kind.");
    const worker = await db.query.workers.findFirst({
      where: and(eq(workers.id, body.workerId), eq(workers.agencyId, ctx.org.id)),
      columns: { id: true },
    });
    if (!worker) throw new ApiError(404, "NOT_FOUND", "Worker not found.");
  }

  const key = buildObjectKey(body.kind, ctx.org.id, body.contentType, body.workerId);
  const url = await signUploadUrl(key, body.contentType);
  return json({ key, url, expiresIn: SIGNED_URL_TTL_SECONDS });
});
