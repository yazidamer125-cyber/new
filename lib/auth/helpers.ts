import { headers } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from ".";
import { db } from "@/lib/db";
import { organizations, users, type Organization, type User } from "@/lib/db/schema";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type SessionContext = {
  user: User;
  org: Organization | null;
};

/**
 * Resolves the Better Auth session into our domain context (user row + org
 * row). Cached per request so layouts, pages and helpers share one lookup.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session?.user) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return null;
  const org = user.orgId
    ? ((await db.query.organizations.findFirst({ where: eq(organizations.id, user.orgId) })) ?? null)
    : null;
  return { user, org };
});

/** Session guard: 401 when unauthenticated. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required.");
  return ctx;
}

/**
 * Product rule #3: organizations must pass license verification before they
 * can post, propose, or view worker data. Pending orgs get 403 ORG_PENDING
 * and only see their own onboarding checklist.
 */
export async function requireVerifiedOrg(): Promise<SessionContext & { org: Organization }> {
  const ctx = await requireUser();
  if (!ctx.org) throw new ApiError(403, "NO_ORG", "This account is not attached to an organization.");
  if (ctx.org.verificationStatus === "rejected") {
    throw new ApiError(403, "ORG_REJECTED", "Your organization's license verification was rejected.");
  }
  if (ctx.org.verificationStatus !== "verified") {
    throw new ApiError(403, "ORG_PENDING", "Your organization is pending license verification.");
  }
  if (ctx.org.suspendedAt) {
    throw new ApiError(403, "ORG_SUSPENDED", "Your organization account has been suspended.");
  }
  return ctx as SessionContext & { org: Organization };
}

export async function requireRole(...roles: User["role"][]): Promise<SessionContext> {
  const ctx = await requireUser();
  if (!roles.includes(ctx.user.role)) {
    throw new ApiError(403, "FORBIDDEN_ROLE", "Your role does not allow this action.");
  }
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  return requireRole("platform_admin");
}

/** Verified org of a specific type (agency-only / office-only endpoints). */
export async function requireOrgType(
  type: Organization["type"],
): Promise<SessionContext & { org: Organization }> {
  const ctx = await requireVerifiedOrg();
  if (ctx.org.type !== type) {
    throw new ApiError(403, "WRONG_ORG_TYPE", `This action is only available to ${type} organizations.`);
  }
  return ctx;
}
