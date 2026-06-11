import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitations, organizations, users } from "@/lib/db/schema";
import { auth, INTERNAL_SIGNUP_HEADER } from "@/lib/auth";
import { ApiError } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { registerSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite-only registration (rule: private platform).
 * 1. Validates the invitation token (unused, unexpired, matching email).
 * 2. Creates the organization with verification_status 'pending'.
 * 3. Creates the user via Better Auth as the org 'owner'.
 * 4. Marks the invitation used and audit-logs everything.
 */
export const POST = withApi(async (req: NextRequest) => {
  const body = registerSchema.parse(await req.json());

  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.token, body.token), isNull(invitations.usedAt)),
  });
  if (!invitation) throw new ApiError(403, "INVALID_INVITE", "Invitation not found or already used.");
  if (invitation.expiresAt < new Date()) {
    throw new ApiError(403, "INVITE_EXPIRED", "This invitation has expired.");
  }
  if (invitation.email.toLowerCase() !== body.email.toLowerCase()) {
    throw new ApiError(403, "INVITE_EMAIL_MISMATCH", "This invitation was issued for a different email.");
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, body.email.toLowerCase()) });
  if (existing) throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.");

  const [org] = await db
    .insert(organizations)
    .values({
      name: body.orgName,
      type: invitation.orgType,
      country: body.country,
      city: body.city ?? null,
      licenseNumber: body.licenseNumber ?? null,
      verificationStatus: "pending",
    })
    .returning();

  // Better Auth sign-up, unlocked via the internal header (the public
  // endpoint rejects calls without it). Cookies for the new session are set
  // by the nextCookies plugin.
  const internalHeaders = new Headers(req.headers);
  internalHeaders.set(INTERNAL_SIGNUP_HEADER, process.env.BETTER_AUTH_SECRET ?? "");
  let signUp;
  try {
    signUp = await auth.api.signUpEmail({
      body: { email: body.email.toLowerCase(), password: body.password, name: body.name },
      headers: internalHeaders,
    });
  } catch (err) {
    // Roll back the org so a failed signup doesn't leave an orphan.
    await db.delete(organizations).where(eq(organizations.id, org.id));
    throw err;
  }

  await db
    .update(users)
    .set({ orgId: org.id, role: "owner" })
    .where(eq(users.id, signUp.user.id));

  await db.update(invitations).set({ usedAt: new Date() }).where(eq(invitations.id, invitation.id));

  await logAction({
    actorUserId: signUp.user.id,
    actorOrgId: org.id,
    action: "org.registered",
    entityType: "organization",
    entityId: org.id,
    context: { invitationId: invitation.id, orgType: invitation.orgType },
  });

  return json({ ok: true, orgId: org.id, verificationStatus: "pending" }, 201);
});
