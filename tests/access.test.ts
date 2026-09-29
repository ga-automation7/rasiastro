import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken, resolveAccessToken, revokeOrderTokens, tokenGrantsOrder } from "@/server/access/tokens";
import { getDb } from "@/server/db";
import { processRecoveryRequest } from "@/server/delivery/service";
import { setEmailProviderForTests } from "@/server/delivery/email";
import { createOrder } from "@/server/orders/service";
import { hashToken } from "@/server/security/crypto";
import { escapeHtml, html } from "@/server/reports/html";
import { scrubText } from "@/server/log";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb } from "./helpers";

describe("no-login report access", () => {
  let email: CapturingEmailProvider;
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });
  beforeEach(() => {
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
  });
  afterEach(() => resetOverrides());

  it("stores only a hash of the token, and the token opens only its own order", async () => {
    const a = await createOrder(orderInput(), "ip-a");
    const b = await createOrder(orderInput(), "ip-b");
    expect(a.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const db = await getDb();
    const stored = await db.query<{ token_hash: string }>("select token_hash from access_tokens where order_id = $1::uuid", [a.orderId]);
    expect(stored[0]!.token_hash).toBe(hashToken(a.accessToken));
    expect(JSON.stringify(stored)).not.toContain(a.accessToken);
    expect(await tokenGrantsOrder(db, a.accessToken, a.orderId)).toBe(true);
    expect(await tokenGrantsOrder(db, a.accessToken, b.orderId)).toBe(false);
  });

  it("an order reference or email alone never grants access", async () => {
    const a = await createOrder(orderInput(), "ip-c");
    const db = await getDb();
    expect(await resolveAccessToken(db, a.reference)).toBeNull();
    expect(await resolveAccessToken(db, "customer@example.com")).toBeNull();
    expect(await resolveAccessToken(db, crypto.randomBytes(32).toString("base64url"))).toBeNull();
    expect(await resolveAccessToken(db, undefined)).toBeNull();
  });

  it("expired and revoked links stop working", async () => {
    const a = await createOrder(orderInput(), "ip-d");
    const db = await getDb();
    const extra = await issueAccessToken(db, a.orderId, "owner", 1);
    await db.query("update access_tokens set expires_at = now() - interval '1 second' where token_hash = $1", [hashToken(extra.token)]);
    expect(await resolveAccessToken(db, extra.token)).toBeNull();
    expect(await resolveAccessToken(db, a.accessToken)).not.toBeNull();
    await revokeOrderTokens(db, a.orderId);
    expect(await resolveAccessToken(db, a.accessToken)).toBeNull();
  });

  it("recovery emails fresh links only for paid orders, and says nothing otherwise", async () => {
    const paid = await createOrder(orderInput({ email: "paid@example.com" }), "ip-e");
    await (await getDb()).query("update orders set payment_status = 'paid' where id = $1::uuid", [paid.orderId]);
    await createOrder(orderInput({ email: "unpaid@example.com" }), "ip-f");

    await processRecoveryRequest("unpaid@example.com", null, "ip-r1");
    await processRecoveryRequest("nobody@example.com", null, "ip-r2");
    expect(email.sent).toHaveLength(0);

    await processRecoveryRequest("PAID@example.com", null, "ip-r3");
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe("paid@example.com");
    expect(email.sent[0]!.text).toContain(paid.reference);
    expect(email.sent[0]!.html).toMatch(/\/access#t=/);
  });

  it("rate-limits recovery per email address", async () => {
    const paid = await createOrder(orderInput({ email: "limited@example.com" }), "ip-g");
    await (await getDb()).query("update orders set payment_status = 'paid' where id = $1::uuid", [paid.orderId]);
    for (let i = 0; i < 6; i += 1) await processRecoveryRequest("limited@example.com", null, `ip-rl-${i}`);
    expect(email.sent).toHaveLength(3);
  });

  it("rate-limits order creation per client", async () => {
    let failures = 0;
    for (let i = 0; i < 17; i += 1) {
      try {
        await createOrder(orderInput(), "ip-flood");
      } catch {
        failures += 1;
      }
    }
    expect(failures).toBe(2);
  });
});

describe("output safety", () => {
  it("escapes AI or customer text in report HTML", () => {
    const evil = `<script>alert(1)</script><img src=x onerror=alert(2)>`;
    const out = html`<p>${evil}</p>`.value;
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("scrubs emails, phone numbers and token-like strings from logs", () => {
    const text = scrubText("failed for customer@example.com phone +91 98765 43210 token abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789");
    expect(text).not.toContain("customer@example.com");
    expect(text).not.toContain("98765");
    expect(text).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });
});
