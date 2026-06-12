import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { okbRequests, notifications } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { okbStatusSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Office updates OKB status: pending → submitted → approved/rejected. */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const row = await db.query.okbRequests.findFirst({
    where: eq(okbRequests.id, params.id),
    with: { placement: true },
  });
  if (!row || (row.placement.officeId !== ctx.org.id && row.placement.agencyId !== ctx.org.id)) {
    throw new ApiError(404, "NOT_FOUND", "OKB request not found.");
  }
  if (row.placement.officeId !== ctx.org.id) {
    throw new ApiError(403, "FORBIDDEN", "Only the recruitment office manages OKB requests.");
  }

  const { status } = okbStatusSchema.parse(await req.json());
  const [updated] = await db
    .update(okbRequests)
    .set({ status, ...(status === "submitted" ? { submittedAt: new Date() } : {}) })
    .where(eq(okbRequests.id, row.id))
    .returning();

  await db.insert(notifications).values({
    orgId: row.placement.agencyId,
    type: "okb.status_changed",
    title: "تحديث حالة OKB",
    body: `الحالة الجديدة: ${status}`,
    link: "/placements",
  });

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "okb.status_changed",
    entityType: "okb_request",
    entityId: row.id,
    context: { from: row.status, to: status },
  });

  return json({ okbRequest: updated });
});
