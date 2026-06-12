import { NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireUser, ApiError } from "@/lib/auth/helpers";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireUser();
  if (!ctx.org) return json({ notifications: [] });
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.orgId, ctx.org.id), unreadOnly ? isNull(notifications.readAt) : undefined),
    orderBy: desc(notifications.createdAt),
    limit: 50,
  });
  return json({ notifications: rows });
});

/** Mark all (or one) of the org's notifications read. */
export const PATCH = withApi(async (req: NextRequest) => {
  const ctx = await requireUser();
  if (!ctx.org) throw new ApiError(403, "NO_ORG", "No organization context.");
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.orgId, ctx.org.id),
        body.id ? eq(notifications.id, body.id) : isNull(notifications.readAt),
      ),
    );
  return json({ ok: true });
});
