import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inviteRequests, INVITE_REQUEST_STATUSES } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Queue of public "request invite" submissions. */
export const GET = withApi(async (req: NextRequest) => {
  await requireAdmin();
  const status = req.nextUrl.searchParams.get("status");
  const valid = (INVITE_REQUEST_STATUSES as readonly string[]).includes(status ?? "");
  const rows = await db
    .select()
    .from(inviteRequests)
    .where(valid ? eq(inviteRequests.status, status as (typeof INVITE_REQUEST_STATUSES)[number]) : undefined)
    .orderBy(desc(inviteRequests.createdAt));
  return json({ requests: rows });
});
