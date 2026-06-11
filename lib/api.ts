import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/helpers";
import { GuardError } from "@/lib/db/guards";
import { logger } from "@/lib/logger";

type RouteContext = { params: Record<string, string> };
type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse | Response>;

const GUARD_STATUS: Record<string, number> = {
  CONSENT_REQUIRED: 409,
  INVALID_TRANSITION: 409,
  WORKER_NOT_OWNED: 403,
  WORKER_UNAVAILABLE: 409,
  NO_WORKERS: 400,
};

/**
 * Shared route wrapper: normalizes domain errors to JSON
 * `{ error: { code, message } }` and logs unexpected failures.
 */
export function withApi(handler: Handler) {
  return async (req: NextRequest, ctx?: { params?: Record<string, string> }) => {
    try {
      return await handler(req, { params: ctx?.params ?? {} });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      if (err instanceof GuardError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: GUARD_STATUS[err.code] ?? 400 },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Invalid input.", issues: err.flatten() } },
          { status: 422 },
        );
      }
      logger.error({ err, path: req.nextUrl.pathname }, "unhandled api error");
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Something went wrong." } },
        { status: 500 },
      );
    }
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
