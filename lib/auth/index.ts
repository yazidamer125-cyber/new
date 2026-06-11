import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";

/**
 * Registration is invite-only (product rule: private platform). The public
 * Better Auth sign-up endpoint is sealed: it only accepts calls carrying the
 * internal header set by our own /api/register route (which validates the
 * invitation token and creates the organization first) or by seed scripts.
 */
export const INTERNAL_SIGNUP_HEADER = "x-wakilpro-internal-signup";

function internalSignupSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return secret;
}

export const auth = betterAuth({
  appName: "WakilPro",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      // Never accepted from client input; set server-side during /api/register.
      orgId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false, defaultValue: "owner" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const header = ctx.headers?.get(INTERNAL_SIGNUP_HEADER);
        if (header !== internalSignupSecret()) {
          throw new APIError("FORBIDDEN", {
            message: "Registration is invite-only. Use /api/register with a valid invitation token.",
            code: "INVITE_REQUIRED",
          });
        }
      }
    }),
  },
  // nextCookies must stay last; disabled for CLI scripts (no Next request scope).
  plugins: process.env.WAKILPRO_SCRIPT === "1" ? [] : [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
