import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminEmailForToken, adminEmails, checkAdminCode, createAdminSession, requestAdminCode } from "@/server/admin/auth";
import { parseFilters } from "@/server/admin/filters";
import { listOrders } from "@/server/admin/records";
import { getDb } from "@/server/db";
import { setEmailProviderForTests } from "@/server/delivery/email";
import { buildOwnerCsv } from "@/server/exports/csv";
import { buildOwnerWorkbook } from "@/server/exports/xlsx";
import { createCompatibilityOrder, createOrder } from "@/server/orders/service";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb } from "./helpers";

const OWNER = "owner@rasiastro.example";

describe("admin sign-in", () => {
  let email: CapturingEmailProvider;
  beforeAll(async () => {
    setTestEnv({ ADMIN_EMAILS: OWNER });
    await setupTestDb();
  });
  beforeEach(() => {
    setTestEnv({ ADMIN_EMAILS: OWNER });
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
  });
  afterEach(() => resetOverrides());

  it("is switched off without ADMIN_EMAILS", () => {
    setTestEnv({ ADMIN_EMAILS: undefined });
    expect(adminEmails()).toEqual([]);
  });

  it("emails a code only to an allowed address", async () => {
    await requestAdminCode("stranger@example.com", `ip-${crypto.randomUUID()}`);
    expect(email.sent).toHaveLength(0);
    await requestAdminCode(OWNER.toUpperCase(), `ip-${crypto.randomUUID()}`);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.to).toBe(OWNER);
  });

  it("accepts the right code once, rejects wrong codes, and locks after five wrong tries", async () => {
    await requestAdminCode(OWNER, `ip-${crypto.randomUUID()}`);
    const code = /(\d{6})/.exec(email.sent.at(-1)!.text)![1]!;
    const db = await getDb();
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await checkAdminCode(db, OWNER, wrong)).toBe(false);
    expect(await checkAdminCode(db, "stranger@example.com", code)).toBe(false);
    expect(await checkAdminCode(db, OWNER, code)).toBe(true);
    expect(await checkAdminCode(db, OWNER, code)).toBe(false); // used up

    await requestAdminCode(OWNER, `ip-${crypto.randomUUID()}`);
    const second = /(\d{6})/.exec(email.sent.at(-1)!.text)![1]!;
    const bad = second === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) await checkAdminCode(db, OWNER, bad);
    expect(await checkAdminCode(db, OWNER, second)).toBe(false);
  });

  it("sessions stop working when the address is removed from ADMIN_EMAILS", async () => {
    const db = await getDb();
    const { token } = await createAdminSession(db, OWNER);
    expect(await adminEmailForToken(db, token)).toBe(OWNER);
    expect(await adminEmailForToken(db, "x".repeat(43))).toBeNull();
    setTestEnv({ ADMIN_EMAILS: "someone-else@example.com" });
    expect(await adminEmailForToken(db, token)).toBeNull();
  });
});

describe("admin records and exports", () => {
  beforeAll(async () => {
    setTestEnv({ ADMIN_EMAILS: OWNER });
    await setupTestDb();
    await createOrder(orderInput({ language: "ta" }, { subjectName: "முருகன் செல்வம்" }), `ip-${crypto.randomUUID()}`);
    await createOrder(orderInput({}, { subjectName: "=HYPERLINK(\"http://evil\")" }), `ip-${crypto.randomUUID()}`);
    const base = {
      category: "friendship",
      tradition: "indian",
      language: "en",
      shared: { howKnown: "Old friends", knownDuration: null, hopes: null, sharedCircumstances: null },
      email: "pair@example.com",
      phone: "9876543210",
      consentProcessing: true,
      adultConfirmed: true,
      thirdPartyPermission: true,
    } as const;
    const person = (name: string, placeId: string) => ({
      birth: { subjectName: name, birthDate: "1990-01-01", timeCertainty: "unknown" as const, birthTime: null, timeWindowMinutes: null, dstChoice: null, placeId },
      known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null },
      additionalInfo: `Notes about ${name}`,
    });
    await createCompatibilityOrder({ ...base, participants: [person("Asha", "demo:chennai"), person("Ravi", "demo:mumbai")] }, `ip-${crypto.randomUUID()}`);
  });

  it("filters by report type and payment status; unpaid orders are marked", async () => {
    const db = await getDb();
    const all = await listOrders(db, parseFilters({}), 1, 50);
    expect(all.total).toBe(3);
    const pairs = await listOrders(db, parseFilters({ product: "compatibility" }), 1, 50);
    expect(pairs.total).toBe(1);
    expect(pairs.rows[0]!.names).toBe("Asha & Ravi");
    expect((await listOrders(db, parseFilters({ payment: "paid" }), 1, 50)).total).toBe(0);
    expect((await listOrders(db, parseFilters({ payment: "unpaid" }), 1, 50)).total).toBe(3);
    expect((await listOrders(db, parseFilters({ q: "asha" }), 1, 50)).total).toBe(1);
  });

  it("exports every matching record, not just one page", async () => {
    const db = await getDb();
    const page = await listOrders(db, parseFilters({}), 1, 1);
    expect(page.rows).toHaveLength(1);
    const { count } = await buildOwnerCsv(db, parseFilters({}));
    expect(count).toBe(3);
    const { counts } = await buildOwnerWorkbook(db, { ...parseFilters({ product: "compatibility" }) });
    expect(counts.orders).toBe(1);
    expect(counts.participants).toBe(2);
  });

  it("writes UTF-8 CSV with Indian scripts intact and no live formulas", async () => {
    const { csv } = await buildOwnerCsv(await getDb(), parseFilters({}));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("முருகன் செல்வம்");
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain("UNPAID");
    expect(csv).toContain("Notes about Ravi");
  });
});
