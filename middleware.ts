import { NextRequest, NextResponse } from "next/server";

/**
 * Coarse edge gate: dashboard paths need a session cookie. Real authorization
 * (org verification, roles, worker visibility) is enforced server-side in
 * lib/auth/helpers.ts and lib/db/guards.ts — never here.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/workers",
  "/job-orders",
  "/proposals",
  "/placements",
  "/admin",
  "/notifications",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const hasSession =
    req.cookies.has("better-auth.session_token") || req.cookies.has("__Secure-better-auth.session_token");
  if (!hasSession) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
