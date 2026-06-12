import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { inviteRequests } from "@/lib/db/schema";
import { requestInviteSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";
import { logAction } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public form: lands in the admin queue; no account is created. */
export const POST = withApi(async (req: NextRequest) => {
  const body = requestInviteSchema.parse(await req.json());
  const [row] = await db.insert(inviteRequests).values(body).returning();
  await logAction({
    action: "invite_request.created",
    entityType: "invite_request",
    entityId: row.id,
    context: { orgType: body.orgType, country: body.country },
  });
  return json({ ok: true }, 201);
});
