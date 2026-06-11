import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, notifications } from "@/lib/db/schema";
import { requireAdmin, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { orgRejectSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");

  const { reason } = orgRejectSchema.parse(await req.json());
  const [updated] = await db
    .update(organizations)
    .set({ verificationStatus: "rejected", rejectionReason: reason })
    .where(eq(organizations.id, org.id))
    .returning();

  await db.insert(notifications).values({
    orgId: org.id,
    type: "org.rejected",
    title: "تعذّر التحقق من الترخيص",
    body: reason,
    link: "/onboarding",
  });

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.rejected",
    entityType: "organization",
    entityId: org.id,
    context: { reason },
  });

  return json({ org: updated });
});
