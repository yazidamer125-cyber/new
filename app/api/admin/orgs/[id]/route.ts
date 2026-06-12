import { NextRequest } from "next/server";
import { and, count, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  workers,
  consents,
  jobOrders,
  proposals,
  proposalWorkers,
  placements,
  notifications,
  documents,
} from "@/lib/db/schema";
import { requireAdmin, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { withApi, json } from "@/lib/api";
import { orgEditSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH – edit basic org details (name, country, city, licenseNumber). */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const body = orgEditSchema.parse(await req.json());

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");

  const [updated] = await db
    .update(organizations)
    .set({ ...body })
    .where(eq(organizations.id, org.id))
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.edited",
    entityType: "organization",
    entityId: org.id,
    context: body as Record<string, unknown>,
  });

  return json({ org: updated });
});

/**
 * DELETE – hard-delete an organization.
 * Blocked if the org has any placements (operational/financial records).
 * Cascades: workers, consents, job_orders, proposals, notifications, documents.
 */
export const DELETE = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, params.id) });
  if (!org) throw new ApiError(404, "NOT_FOUND", "Organization not found.");

  const [placementCount] = await db
    .select({ n: count() })
    .from(placements)
    .where(or(eq(placements.agencyId, org.id), eq(placements.officeId, org.id)));

  if (placementCount.n > 0) {
    throw new ApiError(
      409,
      "HAS_PLACEMENTS",
      "لا يمكن حذف منشأة لها سجلات إجراءات. علّق الحساب بدلًا من ذلك.",
    );
  }

  // Cascade in dependency order.
  await db.delete(notifications).where(eq(notifications.orgId, org.id));
  await db.delete(documents).where(eq(documents.ownerOrgId, org.id));

  if (org.type === "source_agency") {
    const workerIds = (
      await db.select({ id: workers.id }).from(workers).where(eq(workers.agencyId, org.id))
    ).map((w) => w.id);

    if (workerIds.length) {
      for (const wid of workerIds) {
        await db.delete(proposalWorkers).where(eq(proposalWorkers.workerId, wid));
        await db.delete(consents).where(eq(consents.workerId, wid));
      }
      await db.delete(workers).where(eq(workers.agencyId, org.id));
    }
    await db.delete(proposals).where(eq(proposals.agencyId, org.id));
  } else {
    const orderIds = (
      await db.select({ id: jobOrders.id }).from(jobOrders).where(eq(jobOrders.officeId, org.id))
    ).map((j) => j.id);

    if (orderIds.length) {
      await db.delete(proposals).where(
        and(...orderIds.map((oid) => eq(proposals.jobOrderId, oid))),
      );
    }
    await db.delete(jobOrders).where(eq(jobOrders.officeId, org.id));
  }

  await db.delete(organizations).where(eq(organizations.id, org.id));

  await logAction({
    actorUserId: ctx.user.id,
    action: "org.deleted",
    entityType: "organization",
    entityId: org.id,
    context: { name: org.name, type: org.type },
  });

  return json({ ok: true });
});
