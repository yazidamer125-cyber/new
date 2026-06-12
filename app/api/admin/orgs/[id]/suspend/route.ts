import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, notifications } from "@/lib/db/schema";
import { requireAdmin, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { withApi, json } from "@/lib/api";
import { orgSuspendSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST – suspend an organization (blocks dashboard access). */
export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const { reason } = orgSuspendSchema.parse(await req.json());

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  if (org.suspendedAt) throw new ApiError(409, "ALREADY_SUSPENDED", "Organization is already suspended.");

  const [updated] = await db
    .update(organizations)
    .set({ suspendedAt: new Date(), suspensionReason: reason })
    .where(eq(organizations.id, org.id))
    .returning();

  await db.insert(notifications).values({
    orgId: org.id,
    type: "org.suspended",
    title: "تم تعليق حساب منشأتكم",
    body: `السبب: ${reason}. للاستفسار تواصلوا مع إدارة المنصة.`,
    link: "/suspended",
  });

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.suspended",
    entityType: "organization",
    entityId: org.id,
    context: { reason },
  });

  return json({ org: updated });
});

/** DELETE – lift suspension (restore access). */
export const DELETE = withApi(async (_req: NextRequest, { params }) => {
  const ctx = await requireAdmin();

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  if (!org.suspendedAt) throw new ApiError(409, "NOT_SUSPENDED", "Organization is not suspended.");

  const [updated] = await db
    .update(organizations)
    .set({ suspendedAt: null, suspensionReason: null })
    .where(eq(organizations.id, org.id))
    .returning();

  await db.insert(notifications).values({
    orgId: org.id,
    type: "org.unsuspended",
    title: "تم رفع التعليق عن حسابكم",
    body: "أصبح بإمكانكم الآن استخدام المنصة مجدداً.",
    link: "/dashboard",
  });

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.unsuspended",
    entityType: "organization",
    entityId: org.id,
  });

  return json({ org: updated });
});
