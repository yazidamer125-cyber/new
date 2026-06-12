import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { r2HealthCheck } from "@/lib/r2";
import { logger } from "@/lib/logger";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = { db: "fail", r2: "fail" };
  try {
    await db.run(sql`SELECT 1`);
    checks.db = "ok";
  } catch (err) {
    logger.error({ err }, "health: db check failed");
  }
  try {
    await r2HealthCheck();
    checks.r2 = "ok";
  } catch (err) {
    logger.error({ err }, "health: r2 check failed");
  }
  const healthy = checks.db === "ok" && checks.r2 === "ok";
  return json({ status: healthy ? "healthy" : "degraded", checks }, healthy ? 200 : 503);
}
