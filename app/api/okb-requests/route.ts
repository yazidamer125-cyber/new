import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placements, okbRequests } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { okbCreateSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Office files an OK-to-board request for a placement in ticketing/okb stage. */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireVerifiedOrg();
  const body = okbCreateSchema.parse(await req.json());

  const placement = await db.query.placements.findFirst({ where: eq(placements.id, body.placementId) });
  if (!placement || (placement.officeId !== ctx.org.id && placement.agencyId !== ctx.org.id)) {
    throw new ApiError(404, "NOT_FOUND", "Placement not found.");
  }
  if (placement.officeId !== ctx.org.id) {
    throw new ApiError(403, "FORBIDDEN", "Only the recruitment office files OKB requests.");
  }
  if (!["ticketing", "okb"].includes(placement.stage)) {
    throw new ApiError(409, "WRONG_STAGE", "OKB requests are filed at the ticketing/okb stage.");
  }

  const [row] = await db
    .insert(okbRequests)
    .values({
      placementId: placement.id,
      airline: body.airline,
      flightNo: body.flightNo ?? null,
      pnr: body.pnr ?? null,
      travelDate: body.travelDate ?? null,
      route: body.route ?? null,
      status: "pending",
    })
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "okb.created",
    entityType: "okb_request",
    entityId: row.id,
    context: { placementId: placement.id, airline: body.airline },
  });

  return json({ okbRequest: row }, 201);
});
