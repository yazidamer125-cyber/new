import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobOrders, organizations } from "@/lib/db/schema";
import { requireVerifiedOrg } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { jobOrderSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demand board. Agencies see OPEN job orders from verified offices with the
 * office identity masked (country only) until their proposal is shortlisted.
 * Offices see their own orders.
 */
export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();

  if (ctx.org.type === "recruitment_office") {
    const rows = await db
      .select()
      .from(jobOrders)
      .where(eq(jobOrders.officeId, ctx.org.id))
      .orderBy(desc(jobOrders.createdAt));
    return json({ jobOrders: rows });
  }

  const position = req.nextUrl.searchParams.get("position");
  const rows = await db
    .select({
      id: jobOrders.id,
      position: jobOrders.position,
      nationalityPref: jobOrders.nationalityPref,
      quantity: jobOrders.quantity,
      salaryOffer: jobOrders.salaryOffer,
      currency: jobOrders.currency,
      contractMonths: jobOrders.contractMonths,
      targetTravelDate: jobOrders.targetTravelDate,
      specialRequirements: jobOrders.specialRequirements,
      status: jobOrders.status,
      createdAt: jobOrders.createdAt,
      // office identity masked: country only (rendered as "مكتب موثّق — {country}")
      officeCountry: organizations.country,
    })
    .from(jobOrders)
    .innerJoin(organizations, eq(jobOrders.officeId, organizations.id))
    .where(
      and(
        eq(jobOrders.status, "open"),
        eq(organizations.verificationStatus, "verified"),
        position ? eq(jobOrders.position, position as (typeof jobOrders.position.enumValues)[number]) : undefined,
      ),
    )
    .orderBy(desc(jobOrders.createdAt));
  return json({ jobOrders: rows });
});

/** Post a job order (offices only). */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== "recruitment_office") {
    return json({ error: { code: "WRONG_ORG_TYPE", message: "Only recruitment offices post job orders." } }, 403);
  }
  const { expiresInDays, ...body } = jobOrderSchema.parse(await req.json());
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(jobOrders)
    .values({ ...body, officeId: ctx.org.id, status: "open", expiresAt })
    .returning();
  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "job_order.created",
    entityType: "job_order",
    entityId: row.id,
  });
  return json({ jobOrder: row }, 201);
});
