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
  "/marketplace",
];

// Public-only routes: redirect authenticated users straight to the dashboard.
const AUTH_REDIRECT_PATHS = ["/", "/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession =
    req.cookies.has("better-auth.session_token") || req.cookies.has("__Secure-better-auth.session_token");

  // Authenticated user landing on a public-only page → send to dashboard.
  if (hasSession && AUTH_REDIRECT_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Unauthenticated user trying to reach a protected page → send to login.
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
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
