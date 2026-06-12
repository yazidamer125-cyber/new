import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { requireUser, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { licenseSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Onboarding step: submit license number + uploaded license document.
 * Available to pending orgs (that's the point); resubmission after a
 * rejection moves the org back to 'pending' for a fresh review.
 */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireUser();
  if (!ctx.org) throw new ApiError(403, "NO_ORG", "No organization context.");
  if (ctx.user.role !== "owner") throw new ApiError(403, "FORBIDDEN_ROLE", "Only the owner submits the license.");
  if (ctx.org.verificationStatus === "verified") {
    throw new ApiError(409, "ALREADY_VERIFIED", "Organization is already verified.");
  }

  const body = licenseSchema.parse(await req.json());
  if (!body.licenseDocKey.startsWith(`org/${ctx.org.id}/license/`)) {
    throw new ApiError(403, "BAD_KEY", "License document key does not belong to your organization.");
  }

  const [updated] = await db
    .update(organizations)
    .set({
      licenseNumber: body.licenseNumber,
      licenseDocKey: body.licenseDocKey,
      verificationStatus: "pending",
      rejectionReason: null,
    })
    .where(eq(organizations.id, ctx.org.id))
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "org.license_submitted",
    entityType: "organization",
    entityId: ctx.org.id,
  });

  return json({ org: updated });
});
