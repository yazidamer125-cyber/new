import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, notifications } from "@/lib/db/schema";
import { requireAdmin, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rule #3: admin approves the uploaded license; unlocks the full dashboard. */
export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  if (!org.licenseDocKey) {
    throw new ApiError(409, "NO_LICENSE", "Organization has not uploaded a license document yet.");
  }

  const [updated] = await db
    .update(organizations)
    .set({ verificationStatus: "verified", verifiedAt: new Date(), rejectionReason: null })
    .where(eq(organizations.id, org.id))
    .returning();

  await db.insert(notifications).values({
    orgId: org.id,
    type: "org.verified",
    title: "تم التحقق من ترخيص منشأتك",
    body: "أصبح بإمكانكم الآن استخدام كامل المنصة.",
    link: "/dashboard",
  });

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.verified",
    entityType: "organization",
    entityId: org.id,
  });

  return json({ org: updated });
});
