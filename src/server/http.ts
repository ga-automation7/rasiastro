import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, tokenGrantsOrder } from "./access/tokens";
import { getEnv } from "./config/env";
import { getDb } from "./db";
import { AppError, orderNotAccessible } from "./errors";
import { log } from "./log";

/**
 * Route-handler helpers: consistent JSON errors, no-store caching, and order access
 * checks. Unexpected errors are logged and returned as a generic message.
 */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse {
  return NextResponse.json(data, { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } });
}

export function errorResponse(error: unknown, route: string): NextResponse {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message, fields: error.fieldErrors ?? null } }, { status: error.status });
  }
  log.error("unhandled route error", { route, error });
  return json({ error: { code: "internal_error", message: "Something went wrong on our side. Please try again in a moment." } }, { status: 500 });
}

export function withErrors<A extends unknown[]>(route: string, handler: (...args: A) => Promise<NextResponse | Response>) {
  return async (...args: A): Promise<NextResponse | Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error, route);
    }
  };
}

/** Identity for rate limiting. Vercel sets x-forwarded-for; the value is HMAC'd before storage. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || h.get("x-real-ip") || "unknown"}`;
}

export async function readJson(request: Request, maxBytes = 32_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("validation_failed", "Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("validation_failed", "Invalid request.");
  }
}

/** Throws a not-found error (never "forbidden") unless this browser holds a valid token for the order. */
export async function requireOrderAccess(orderId: string): Promise<void> {
  if (!(await hasOrderAccess(orderId))) throw orderNotAccessible();
}

export async function hasOrderAccess(orderId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(accessCookieName(orderId))?.value;
  if (!token) return false;
  return tokenGrantsOrder(await getDb(), token, orderId);
}

export async function setOrderAccessCookie(orderId: string, token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(accessCookieName(orderId), token, {
    httpOnly: true,
    secure: getEnv().PUBLIC_SITE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Rejects cross-site form posts to state-changing JSON endpoints (defence in depth with SameSite cookies). */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return;
  const expected = new URL(getEnv().PUBLIC_SITE_URL).origin;
  const host = h.get("host");
  if (origin !== expected && !(host && new URL(origin).host === host)) {
    throw new AppError("forbidden", "Cross-site request refused.");
  }
}
