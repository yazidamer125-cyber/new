import { NextRequest } from "next/server";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/helpers";
import { withApi, json } from "@/lib/api";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST – apply any pending Drizzle migrations. Admin-only, idempotent. */
export const POST = withApi(async (_req: NextRequest) => {
  await requireAdmin();
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return json({ ok: true, message: "Migrations applied successfully." });
});
