import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, VERIFICATION_STATUSES } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/orgs?status=pending — license verification queue. */
export const GET = withApi(async (req: NextRequest) => {
  await requireAdmin();
  const status = req.nextUrl.searchParams.get("status");
  const valid = (VERIFICATION_STATUSES as readonly string[]).includes(status ?? "");
  const rows = await db
    .select()
    .from(organizations)
    .where(valid ? eq(organizations.verificationStatus, status as (typeof VERIFICATION_STATUSES)[number]) : undefined)
    .orderBy(desc(organizations.createdAt));
  return json({ orgs: rows });
});
