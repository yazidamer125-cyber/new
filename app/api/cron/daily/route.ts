import { NextRequest } from "next/server";
import { and, eq, gte, isNotNull, lte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, jobOrders, notifications, workers } from "@/lib/db/schema";
import { logAction } from "@/lib/auth/audit";
import { logger } from "@/lib/logger";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vercel Cron (daily):
 *  1. Documents (and passports) expiring within 30 days → in-app notification
 *     for the owning org.
 *  2. Job orders past expires_at → status 'expired' + notification.
 * Secured with the CRON_SECRET bearer token Vercel attaches automatically.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: { code: "FORBIDDEN", message: "Invalid cron secret." } }, 401);
  }

  const today = new Date();
  const horizon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1a. Uploaded documents expiring within 30 days.
  const expiringDocs = await db
    .select()
    .from(documents)
    .where(
      and(isNotNull(documents.expiryDate), gte(documents.expiryDate, isoDay(today)), lte(documents.expiryDate, isoDay(horizon))),
    );
  for (const doc of expiringDocs) {
    await db.insert(notifications).values({
      orgId: doc.ownerOrgId,
      type: "document.expiring",
      title: "مستند قارب على الانتهاء",
      body: `${doc.fileName} (${doc.type}) ينتهي بتاريخ ${doc.expiryDate}`,
      link: doc.workerId ? `/workers/${doc.workerId}/edit` : "/dashboard",
    });
  }

  // 1b. Worker passports expiring within 30 days.
  const expiringPassports = await db
    .select({ id: workers.id, agencyId: workers.agencyId, fullName: workers.fullName, passportExpiry: workers.passportExpiry })
    .from(workers)
    .where(
      and(
        isNotNull(workers.passportExpiry),
        gte(workers.passportExpiry, isoDay(today)),
        lte(workers.passportExpiry, isoDay(horizon)),
      ),
    );
  for (const w of expiringPassports) {
    await db.insert(notifications).values({
      orgId: w.agencyId,
      type: "passport.expiring",
      title: "جواز سفر قارب على الانتهاء",
      body: `جواز ${w.fullName} ينتهي بتاريخ ${w.passportExpiry}`,
      link: `/workers/${w.id}/edit`,
    });
  }

  // 2. Auto-expire stale job orders.
  const stale = await db
    .select()
    .from(jobOrders)
    .where(and(eq(jobOrders.status, "open"), isNotNull(jobOrders.expiresAt), lt(jobOrders.expiresAt, today)));
  for (const order of stale) {
    await db.update(jobOrders).set({ status: "expired" }).where(eq(jobOrders.id, order.id));
    await db.insert(notifications).values({
      orgId: order.officeId,
      type: "job_order.expired",
      title: "انتهت صلاحية أمر التوظيف",
      body: `أمر التوظيف (${order.position}) انتهت مدته تلقائيًا`,
      link: `/job-orders/${order.id}`,
    });
    await logAction({
      action: "job_order.expired",
      entityType: "job_order",
      entityId: order.id,
      context: { via: "cron" },
    });
  }

  const summary = {
    expiringDocuments: expiringDocs.length,
    expiringPassports: expiringPassports.length,
    expiredJobOrders: stale.length,
  };
  logger.info(summary, "daily cron completed");
  return json({ ok: true, ...summary });
}
