import { beforeAll, describe, expect, it } from "vitest";
import { PRICING, PRICING_VERSION } from "@/config/pricing";
import { formatInr, paiseToRupeeAmount, quotePackage, rupeeAmountToPaise } from "@/domain/pricing";
import { getDb } from "@/server/db";
import { createOrder } from "@/server/orders/service";
import { orderInput, setTestEnv, setupTestDb, THREE_QUESTIONS } from "./helpers";

describe("pricing rules", () => {
  it("report only costs ₹49 (4900 paise)", () => {
    const q = quotePackage(false);
    expect(q.totalAmountPaise).toBe(4900);
    expect(q.baseAmountPaise).toBe(4900);
    expect(q.addonAmountPaise).toBe(0);
    expect(q.packageCode).toBe("report");
    expect(q.currency).toBe("INR");
  });

  it("report + three questions costs ₹69 - the add-on is ₹20 in TOTAL, not per question", () => {
    const q = quotePackage(true);
    expect(PRICING.questionsAddon.amountPaise).toBe(2000);
    expect(PRICING.questionsAddon.questionCount).toBe(3);
    expect(q.totalAmountPaise).toBe(6900);
    expect(q.lines.map((l) => l.amountPaise)).toEqual([4900, 2000]);
    expect(q.packageCode).toBe("report_with_questions");
  });

  it("formats and converts amounts without floating-point drift", () => {
    expect(formatInr(4900)).toBe("₹49");
    expect(formatInr(6900)).toBe("₹69");
    expect(paiseToRupeeAmount(6900)).toBe(69);
    expect(rupeeAmountToPaise("69.00")).toBe(6900);
    expect(rupeeAmountToPaise(49)).toBe(4900);
    expect(rupeeAmountToPaise("49.5")).toBe(4950);
    expect(rupeeAmountToPaise("abc")).toBeNull();
    expect(rupeeAmountToPaise("-49")).toBeNull();
    expect(() => paiseToRupeeAmount(0)).toThrow();
  });
});

describe("server-side price authority", () => {
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  it("ignores any amount the browser sends and stores a price snapshot", async () => {
    const tampered = { ...orderInput(), totalAmountPaise: 100, amount: 1, price: "1.00", baseAmountPaise: 1 } as unknown;
    const created = await createOrder(tampered, "test-tamper-1");
    expect(created.totalAmountPaise).toBe(4900);
    const rows = await (await getDb()).query<{ total_amount_paise: number; base_amount_paise: number; addon_amount_paise: number; price_snapshot: { pricingVersion: string; totalAmountPaise: number } }>(
      "select total_amount_paise, base_amount_paise, addon_amount_paise, price_snapshot from orders where id = $1::uuid",
      [created.orderId],
    );
    expect(rows[0]).toMatchObject({ total_amount_paise: 4900, base_amount_paise: 4900, addon_amount_paise: 0 });
    expect(rows[0]!.price_snapshot.totalAmountPaise).toBe(4900);
    expect(rows[0]!.price_snapshot.pricingVersion).toBe(PRICING_VERSION);
  });

  it("charges ₹69 when the question add-on is selected", async () => {
    const created = await createOrder(orderInput({ includeQuestions: true, questions: THREE_QUESTIONS }), "test-tamper-2");
    expect(created.totalAmountPaise).toBe(6900);
  });

  it("the database rejects an order whose total is not base + add-on", async () => {
    const db = await getDb();
    await expect(
      db.query(
        `insert into orders (reference, mode, tradition, report_language, package_code, pricing_version, currency, base_amount_paise, addon_amount_paise,
          total_amount_paise, price_snapshot, report_email, consent_processing_at, consent_version, delete_after)
         values ('RA-ZZZZZZZZ', 'demo', 'indian', 'en', 'report', 'x', 'INR', 4900, 0, 100, '{}'::jsonb, 'a@b.c', now(), 'v', now())`,
      ),
    ).rejects.toThrow();
  });
});
