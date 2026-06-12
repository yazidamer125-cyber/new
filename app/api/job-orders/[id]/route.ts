import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobOrders, organizations } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { jobOrderStatusSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const row = await db.query.jobOrders.findFirst({ where: eq(jobOrders.id, params.id) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Job order not found.");

  if (ctx.org.type === "recruitment_office") {
    if (row.officeId !== ctx.org.id) throw new ApiError(404, "NOT_FOUND", "Job order not found.");
    return json({ jobOrder: row });
  }

  // Agency: only open orders are visible, office identity masked.
  if (row.status !== "open") throw new ApiError(404, "NOT_FOUND", "Job order not found.");
  const office = await db.query.organizations.findFirst({ where: eq(organizations.id, row.officeId) });
  const { officeId: _hidden, ...masked } = row;
  return json({ jobOrder: { ...masked, officeCountry: office?.country ?? null } });
});

/** Office-only status management (cancel / mark fulfilled / reopen). */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const row = await db.query.jobOrders.findFirst({ where: eq(jobOrders.id, params.id) });
  if (!row || row.officeId !== ctx.org.id) throw new ApiError(404, "NOT_FOUND", "Job order not found.");
  const { status } = jobOrderStatusSchema.parse(await req.json());
  const [updated] = await db.update(jobOrders).set({ status }).where(eq(jobOrders.id, row.id)).returning();
  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "job_order.status_changed",
    entityType: "job_order",
    entityId: row.id,
    context: { from: row.status, to: status },
  });
  return json({ jobOrder: updated });
});
