import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { inviteRequests } from "@/lib/db/schema";
import { requireAdmin, ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["approved", "dismissed"]) });

/** Mark a request approved (then create the invitation) or dismissed. */
export const PATCH = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireAdmin();
  const row = await db.query.inviteRequests.findFirst({ where: eq(inviteRequests.id, params.id) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Invite request not found.");
  const { status } = patchSchema.parse(await req.json());
  const [updated] = await db
    .update(inviteRequests)
    .set({ status })
    .where(eq(inviteRequests.id, row.id))
    .returning();
  await logAction({
    actorUserId: ctx.user.id,
    action: `invite_request.${status}`,
    entityType: "invite_request",
    entityId: row.id,
  });
  return json({ request: updated });
});
