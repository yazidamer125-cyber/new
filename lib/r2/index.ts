import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Product rule #5: all documents live in Cloudflare R2 and are served ONLY
 * via short-lived signed URLs (10 minutes). There are no public URLs and the
 * bucket must not have public access enabled.
 */
export const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes

const globalForR2 = globalThis as unknown as { __wakilproR2?: S3Client };

function buildClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function r2(): S3Client {
  if (!globalForR2.__wakilproR2) globalForR2.__wakilproR2 = buildClient();
  return globalForR2.__wakilproR2;
}

export function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET is not set");
  return b;
}

/** 10-minute signed download URL. */
export async function signDownloadUrl(key: string, fileName?: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ...(fileName
      ? { ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` }
      : {}),
  });
  return getSignedUrl(r2(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

/** 10-minute signed PUT URL for direct browser uploads. */
export async function signUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  return getSignedUrl(r2(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function r2HealthCheck(): Promise<void> {
  await r2().send(new HeadBucketCommand({ Bucket: bucket() }));
}

// ---------------------------------------------------------------------------
// Object key layout. Keys are ALWAYS prefixed with the owning org id so the
// /api/files/sign route can authorize by prefix:
//   org/{orgId}/license/{uuid}.{ext}
//   org/{orgId}/workers/{workerId}/photo/{uuid}.{ext}
//   org/{orgId}/workers/{workerId}/video/{uuid}.{ext}
//   org/{orgId}/workers/{workerId}/consent/{uuid}.pdf
//   org/{orgId}/workers/{workerId}/docs/{uuid}.{ext}
//   org/{orgId}/docs/{uuid}.{ext}
// ---------------------------------------------------------------------------

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const UPLOAD_KINDS = {
  license: { contentTypes: ["application/pdf", "image/jpeg", "image/png"], needsWorker: false },
  consent: { contentTypes: ["application/pdf"], needsWorker: true },
  worker_photo: { contentTypes: ["image/jpeg", "image/png", "image/webp"], needsWorker: true },
  worker_video: { contentTypes: ["video/mp4", "video/webm"], needsWorker: true },
  document: { contentTypes: ["application/pdf", "image/jpeg", "image/png"], needsWorker: false },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export function buildObjectKey(kind: UploadKind, orgId: string, contentType: string, workerId?: string): string {
  const ext = EXT_BY_CONTENT_TYPE[contentType];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  const uuid = crypto.randomUUID();
  switch (kind) {
    case "license":
      return `org/${orgId}/license/${uuid}.${ext}`;
    case "consent":
      return `org/${orgId}/workers/${workerId}/consent/${uuid}.${ext}`;
    case "worker_photo":
      return `org/${orgId}/workers/${workerId}/photo/${uuid}.${ext}`;
    case "worker_video":
      return `org/${orgId}/workers/${workerId}/video/${uuid}.${ext}`;
    case "document":
      return workerId
        ? `org/${orgId}/workers/${workerId}/docs/${uuid}.${ext}`
        : `org/${orgId}/docs/${uuid}.${ext}`;
  }
}

export type ParsedKey = { orgId: string; workerId?: string };

/** Parses the owning org (and worker, when present) out of an object key. */
export function parseObjectKey(key: string): ParsedKey | null {
  const parts = key.split("/");
  if (parts[0] !== "org" || !parts[1]) return null;
  if (parts[2] === "workers" && parts[3]) return { orgId: parts[1], workerId: parts[3] };
  return { orgId: parts[1] };
}
