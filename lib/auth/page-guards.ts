import { redirect } from "next/navigation";
import { getSessionContext, type SessionContext } from "./helpers";
import type { Organization } from "@/lib/db/schema";

/** Server-component guard: redirects to /login when unauthenticated. */
export async function requirePageContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Server-component guard for worker/job-order/proposal screens: pending or
 * rejected orgs are bounced to the onboarding checklist (rule #3); admins to
 * their own console.
 */
export async function requireVerifiedPage(): Promise<SessionContext & { org: Organization }> {
  const ctx = await requirePageContext();
  if (ctx.user.role === "platform_admin") redirect("/admin");
  if (!ctx.org) redirect("/login");
  if (ctx.org.suspendedAt) redirect("/suspended");
  if (ctx.org.verificationStatus !== "verified") redirect("/onboarding");
  return ctx as SessionContext & { org: Organization };
}

export async function requireAdminPage(): Promise<SessionContext> {
  const ctx = await requirePageContext();
  if (ctx.user.role !== "platform_admin") redirect("/dashboard");
  return ctx;
}
