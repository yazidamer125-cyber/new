import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placements, workers, notifications } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { placementStageSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";
import type { PlacementStage } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE_ORDER: PlacementStage[] = [
  "contract",
  "visa",
  "medical",
  "ticketing",
  "okb",
  "traveled",
  "arrived",
];

/** Advance / update a placement stage. Office drives the pipeline; the agency may add notes. */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const placement = await db.query.placements.findFirst({ where: eq(placements.id, params.id) });
  if (!placement || (placement.officeId !== ctx.org.id && placement.agencyId !== ctx.org.id)) {
    throw new ApiError(404, "NOT_FOUND", "Placement not found.");
  }

  const body = placementStageSchema.parse(await req.json());
  const stageChanged = body.stage !== placement.stage;
  if (stageChanged && placement.officeId !== ctx.org.id) {
    throw new ApiError(403, "FORBIDDEN", "Only the recruitment office advances the pipeline.");
  }
  if (placement.stage === "arrived" || placement.stage === "cancelled") {
    throw new ApiError(409, "FINAL_STATE", "Placement is already closed.");
  }

  const [updated] = await db
    .update(placements)
    .set({
      stage: body.stage,
      notes: body.notes ?? placement.notes,
      ...(stageChanged ? { stageUpdatedAt: new Date() } : {}),
    })
    .where(eq(placements.id, placement.id))
    .returning();

  if (stageChanged) {
    // Keep the worker's lifecycle in sync with the pipeline.
    const workerStatus =
      body.stage === "arrived"
        ? "deployed"
        : body.stage === "cancelled"
          ? "available"
          : STAGE_ORDER.indexOf(body.stage) >= STAGE_ORDER.indexOf("visa")
            ? "processing"
            : "reserved";
    await db
      .update(workers)
      .set({ status: workerStatus, updatedAt: new Date() })
      .where(eq(workers.id, placement.workerId));

    const counterpart = ctx.org.id === placement.officeId ? placement.agencyId : placement.officeId;
    await db.insert(notifications).values({
      orgId: counterpart,
      type: "placement.stage_changed",
      title: "تحديث مرحلة التوظيف",
      body: `المرحلة الجديدة: ${body.stage}`,
      link: `/placements`,
    });
  }

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "placement.updated",
    entityType: "placement",
    entityId: placement.id,
    context: { from: placement.stage, to: body.stage },
  });

  return json({ placement: updated });
});
