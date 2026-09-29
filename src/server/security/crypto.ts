import crypto from "node:crypto";
import { getAppSecret } from "../config/env";

/** 256-bit random access token, URL-safe. Shown to the customer once; we keep only its hash. */
export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

// Crockford base32 without I, L, O, U to avoid misreading when customers quote it.
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Human-friendly order reference such as RA-7K3M9Q2X. Random, so it reveals no volume. */
export function generateOrderReference(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += REFERENCE_ALPHABET[b % 32];
  return `RA-${out}`;
}

/** Keyed hash for rate-limit buckets so raw IPs/emails are never stored. */
export function keyedHash(value: string): string {
  return crypto.createHmac("sha256", getAppSecret()).update(value).digest("hex").slice(0, 32);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function sha256Hex(data: Uint8Array | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
