import type { SqlExecutor } from "../db";
import { rateLimited } from "../errors";
import { keyedHash } from "./crypto";

/**
 * Fixed-window rate limiting stored in Postgres, so limits hold across stateless
 * serverless instances. Adequate for launch volumes; move to Redis/Upstash if the
 * rate_limits table becomes hot.
 */
export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  placeSearch: { name: "place_search", limit: 120, windowSeconds: 600 },
  orderPreview: { name: "order_preview", limit: 60, windowSeconds: 600 },
  orderCreate: { name: "order_create", limit: 15, windowSeconds: 3600 },
  // Separate buckets per product, so heavy use of one product never blocks the other.
  compatibilityPreview: { name: "compat_preview", limit: 60, windowSeconds: 600 },
  compatibilityCreate: { name: "compat_create", limit: 15, windowSeconds: 3600 },
  checkout: { name: "checkout", limit: 20, windowSeconds: 3600 },
  paymentRefresh: { name: "payment_refresh", limit: 60, windowSeconds: 600 },
  accessExchange: { name: "access_exchange", limit: 30, windowSeconds: 600 },
  recoveryPerIp: { name: "recovery_ip", limit: 5, windowSeconds: 3600 },
  recoveryPerEmail: { name: "recovery_email", limit: 3, windowSeconds: 3600 },
  funnelEvent: { name: "funnel_event", limit: 30, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;

/** Returns true when the action is allowed (and counts it). */
export async function consumeRateLimit(db: SqlExecutor, rule: RateLimitRule, identity: string): Promise<boolean> {
  const bucket = `${rule.name}:${keyedHash(identity)}`;
  const rows = await db.query<{ count: number }>(
    `insert into rate_limits (bucket_key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2::int) * $2::int), 1)
     on conflict (bucket_key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [bucket, rule.windowSeconds],
  );
  return (rows[0]?.count ?? 0) <= rule.limit;
}

export async function enforceRateLimit(db: SqlExecutor, rule: RateLimitRule, identity: string): Promise<void> {
  if (!(await consumeRateLimit(db, rule, identity))) throw rateLimited();
}

export async function pruneRateLimits(db: SqlExecutor): Promise<void> {
  await db.query("delete from rate_limits where window_start < now() - interval '1 day'");
}
