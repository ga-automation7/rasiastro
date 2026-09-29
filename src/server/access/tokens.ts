import type { SqlExecutor } from "../db";
import { generateAccessToken, hashToken, isWellFormedToken } from "../security/crypto";

/**
 * No-login access: possession of an unguessable, expiring token grants access to one
 * order. Order numbers and email addresses alone never grant access. Only SHA-256
 * hashes are stored, so a database leak does not leak working links.
 */
export type TokenIssuer = "checkout" | "report_email" | "recovery_email" | "owner";

export async function issueAccessToken(
  db: SqlExecutor,
  orderId: string,
  issuedVia: TokenIssuer,
  ttlDays: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateAccessToken();
  const rows = await db.query<{ expires_at: Date }>(
    `insert into access_tokens (order_id, token_hash, issued_via, expires_at)
     values ($1::uuid, $2, $3, now() + ($4::int * interval '1 day'))
     returning expires_at`,
    [orderId, hashToken(token), issuedVia, ttlDays],
  );
  return { token, expiresAt: rows[0]!.expires_at };
}

/** Resolves a token to its order, or null if unknown, expired or revoked. */
export async function resolveAccessToken(db: SqlExecutor, token: unknown): Promise<{ orderId: string; expiresAt: Date } | null> {
  if (!isWellFormedToken(token)) return null;
  const rows = await db.query<{ order_id: string; expires_at: Date }>(
    `update access_tokens set last_used_at = now()
      where token_hash = $1 and revoked_at is null and expires_at > now()
      returning order_id, expires_at`,
    [hashToken(token)],
  );
  const row = rows[0];
  return row ? { orderId: row.order_id, expiresAt: row.expires_at } : null;
}

export async function tokenGrantsOrder(db: SqlExecutor, token: unknown, orderId: string): Promise<boolean> {
  const resolved = await resolveAccessToken(db, token);
  return resolved?.orderId === orderId;
}

export async function revokeOrderTokens(db: SqlExecutor, orderId: string): Promise<void> {
  await db.query(`update access_tokens set revoked_at = now() where order_id = $1::uuid and revoked_at is null`, [orderId]);
}

export const ACCESS_COOKIE_PREFIX = "ra_o_";

export function accessCookieName(orderId: string): string {
  return `${ACCESS_COOKIE_PREFIX}${orderId}`;
}
