import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placements } from "@/lib/db/schema";
import { requireVerifiedOrg } from "@/lib/auth/helpers";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pipeline for both parties: each org sees only placements where it is the
 * office or the agency. Worker fields included here are limited to the
 * counterpart-visible view (the placement IS the access grant).
 */
export const GET = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  const isOffice = ctx.org.type === "recruitment_office";
  const rows = await db.query.placements.findMany({
    where: isOffice ? eq(placements.officeId, ctx.org.id) : eq(placements.agencyId, ctx.org.id),
    orderBy: desc(placements.stageUpdatedAt),
    with: {
      worker: {
        columns: { id: true, fullName: true, position: true, nationality: true, photoKey: true, status: true },
      },
      jobOrder: { columns: { id: true, position: true } },
      office: { columns: { id: true, name: true, country: true } },
      agency: { columns: { id: true, name: true, country: true } },
      okbRequests: true,
    },
  });
  return json({ placements: rows });
});
