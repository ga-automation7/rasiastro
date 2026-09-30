import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "../config/env";
import { getDb, type SqlExecutor } from "../db";
import { getEmailProvider } from "../delivery/email";
import { AppError } from "../errors";
import { log } from "../log";
import { html } from "../reports/html";
import { generateAccessToken, hashToken, isWellFormedToken, timingSafeEqualString } from "../security/crypto";
import { RATE_LIMITS, consumeRateLimit } from "../security/rate-limit";

/**
 * Owner sign-in for the admin dashboard.
 *
 * - Only addresses in ADMIN_EMAILS can sign in; if it is empty the dashboard is off.
 * - Sign-in is a 6-digit code emailed to that address (valid 10 minutes, 5 attempts),
 *   so there is no password to leak and nothing secret in the browser.
 * - A successful sign-in sets an HttpOnly, SameSite=Strict cookie holding a 256-bit
 *   random token; only its SHA-256 hash is stored. Every admin page and API checks it
 *   on the server, and re-checks that the email is still allowed.
 * - Requests for a code always get the same answer, allowed address or not.
 */
export const ADMIN_COOKIE = "ra_admin";
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

export function adminEmails(): string[] {
  return (getEnv().ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

export function isAdminEnabled(): boolean {
  return adminEmails().length > 0;
}

function codeHash(email: string, code: string): string {
  // Bound to the email so a code for one address never works for another.
  return hashToken(`${email}:${code}`);
}

/** Emails a sign-in code if the address is allowed. The caller always shows the same message. */
export async function requestAdminCode(rawEmail: string, clientKey: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const db = await getDb();
  if (!(await consumeRateLimit(db, RATE_LIMITS.adminCodeIp, clientKey))) return;
  if (!(await consumeRateLimit(db, RATE_LIMITS.adminCodeEmail, `admin:${email}`))) return;
  if (!adminEmails().includes(email)) {
    log.warn("admin code requested for an address that is not allowed");
    return;
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.query(
    `insert into admin_login_codes (email, code_hash, expires_at) values ($1, $2, now() + ($3::int * interval '1 minute'))`,
    [email, codeHash(email, code), CODE_MINUTES],
  );
  const body = html`<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#102D40;">
    <p>Your sign-in code for the Rasi Astro dashboard is:</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:bold;">${code}</p>
    <p>It works for ${CODE_MINUTES} minutes. If you did not try to sign in, you can ignore this email.</p>
  </body></html>`.value;
  await getEmailProvider().send({
    to: email,
    subject: "Your Rasi Astro admin sign-in code",
    html: body,
    text: `Your Rasi Astro admin sign-in code is ${code}. It works for ${CODE_MINUTES} minutes.`,
    idempotencyKey: null,
    tags: { kind: "admin_code" },
  });
  log.info("admin sign-in code sent");
}

/** True (and the code is used up) when it is the latest valid code for this allowed email. */
export async function checkAdminCode(db: SqlExecutor, rawEmail: string, rawCode: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code) || !adminEmails().includes(email)) return false;
  const rows = await db.query<{ id: string; code_hash: string; attempts: number }>(
    `select id, code_hash, attempts from admin_login_codes
      where email = $1 and consumed_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [email],
  );
  const row = rows[0];
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return false;
  if (!timingSafeEqualString(row.code_hash, codeHash(email, code))) {
    await db.query(`update admin_login_codes set attempts = attempts + 1 where id = $1::uuid`, [row.id]);
    return false;
  }
  await db.query(`update admin_login_codes set consumed_at = now() where id = $1::uuid`, [row.id]);
  return true;
}

export async function createAdminSession(db: SqlExecutor, email: string): Promise<{ token: string; hours: number }> {
  const token = generateAccessToken();
  const hours = getEnv().ADMIN_SESSION_HOURS;
  await db.query(`insert into admin_sessions (token_hash, email, expires_at) values ($1, $2, now() + ($3::int * interval '1 hour'))`, [hashToken(token), email, hours]);
  return { token, hours };
}

/** The admin email a session token belongs to, if the session is valid and the address still allowed. */
export async function adminEmailForToken(db: SqlExecutor, token: string): Promise<string | null> {
  const rows = await db.query<{ email: string }>(
    `update admin_sessions set last_seen_at = now()
      where token_hash = $1 and revoked_at is null and expires_at > now()
      returning email`,
    [hashToken(token)],
  );
  const email = rows[0]?.email;
  // Removing an address from ADMIN_EMAILS locks it out immediately.
  return email && adminEmails().includes(email) ? email : null;
}

/** Checks a code and, if valid, starts a session (sets the cookie). */
export async function verifyAdminCode(email: string, code: string, clientKey: string): Promise<boolean> {
  const db = await getDb();
  if (!(await consumeRateLimit(db, RATE_LIMITS.adminVerifyIp, clientKey))) throw new AppError("rate_limited", "Too many attempts. Please wait a few minutes.");
  if (!(await checkAdminCode(db, email, code))) return false;
  const session = await createAdminSession(db, email.trim().toLowerCase());
  const store = await cookies();
  store.set(ADMIN_COOKIE, session.token, {
    httpOnly: true,
    secure: getEnv().PUBLIC_SITE_URL.startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: session.hours * 3600,
  });
  log.info("admin signed in");
  return true;
}

/** The signed-in admin's email, or null. Use in pages; use requireAdmin() in API routes. */
export async function currentAdmin(): Promise<string | null> {
  if (!isAdminEnabled()) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!isWellFormedToken(token)) return null;
  return adminEmailForToken(await getDb(), token);
}

/** For admin API routes: answers "not found" to anyone who is not a signed-in admin. */
export async function requireAdmin(): Promise<string> {
  const email = await currentAdmin();
  if (!email) throw new AppError("not_found", "Not found");
  return email;
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (isWellFormedToken(token)) {
    await (await getDb()).query(`update admin_sessions set revoked_at = now() where token_hash = $1`, [hashToken(token)]);
  }
  store.delete(ADMIN_COOKIE);
}
