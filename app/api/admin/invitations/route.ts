import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { invitationCreateSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  await requireAdmin();
  const rows = await db.select().from(invitations).orderBy(desc(invitations.createdAt)).limit(100);
  return json({ invitations: rows });
});

/** Creates an invitation token and returns the invite link to share. */
export const POST = withApi(async (req: NextRequest) => {
  const ctx = await requireAdmin();
  const body = invitationCreateSchema.parse(await req.json());

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(invitations)
    .values({
      email: body.email.toLowerCase(),
      orgType: body.orgType,
      invitedByUserId: ctx.user.id,
      token,
      expiresAt,
    })
    .returning();

  await logAction({
    actorUserId: ctx.user.id,
    action: "invitation.created",
    entityType: "invitation",
    entityId: row.id,
    context: { email: body.email, orgType: body.orgType },
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "";
  return json({ invitation: row, inviteLink: `${baseUrl}/register?token=${token}` }, 201);
});
