import crypto from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { EmailSendError, setEmailProviderForTests } from "@/server/delivery/email";
import { demoPartContent } from "@/server/interpretation/demo-provider";
import type { InterpretationInput } from "@/server/interpretation/input";
import { AiConfigurationError, RetriableAiError, type InterpretationProvider } from "@/server/interpretation/provider";
import type { PartName } from "@/server/interpretation/schema";
import { setInterpretationProviderForTests } from "@/server/interpretation/service";
import { runGenerationLocally } from "@/server/jobs/local-runner";
import { dispatchDue } from "@/server/jobs/dispatch";
import { createOrder } from "@/server/orders/service";
import { applyPaymentEvidence, startCheckout } from "@/server/payments/service";
import { CapturingEmailProvider, orderInput, resetOverrides, setTestEnv, setupTestDb, stubPdf, THREE_QUESTIONS } from "./helpers";

/** Scriptable AI provider: each call pops the next behaviour, default = valid demo content. */
class ScriptedAi implements InterpretationProvider {
  readonly id = "openai" as const;
  readonly model = "test-model";
  readonly isDemo = false;
  calls: { part: PartName; input: InterpretationInput }[] = [];
  behaviours: ("ok" | "timeout" | "malformed" | "config")[] = [];
  async generate(part: PartName, _prompt: { instructions: string; userContent: string }, input: InterpretationInput) {
    this.calls.push({ part, input });
    const behaviour = this.behaviours.shift() ?? "ok";
    if (behaviour === "timeout") throw new RetriableAiError("timeout", "AI request timed out");
    if (behaviour === "config") throw new AiConfigurationError("model_not_found", "model missing");
    if (behaviour === "malformed") return { raw: { unexpected: true }, inputTokens: 10, outputTokens: 10, latencyMs: 5 };
    return { raw: demoPartContent(part, input), inputTokens: 100, outputTokens: 200, latencyMs: 5 };
  }
}

async function paidOrder(options: { questions?: boolean; beforePay?: (orderId: string) => Promise<void> } = {}) {
  const created = await createOrder(
    orderInput(options.questions ? { includeQuestions: true, questions: THREE_QUESTIONS, language: "en" } : { language: "en" }),
    `ip-${crypto.randomUUID()}`,
  );
  await startCheckout(created.orderId, `ip-${crypto.randomUUID()}`);
  await options.beforePay?.(created.orderId);
  const db = await getDb();
  const [payment] = await db.query<{ provider_order_id: string }>("select provider_order_id from payments where order_id = $1::uuid", [created.orderId]);
  await db.query("update payments set provider_status = 'DEMO_SUCCESS' where provider_order_id = $1", [payment!.provider_order_id]);
  await applyPaymentEvidence({ source: "demo", provider: "demo", providerOrderId: payment!.provider_order_id, providerPaymentId: "d", status: "paid", amountPaise: created.totalAmountPaise, currency: "INR", providerStatus: "DEMO_SUCCESS" });
  return created.orderId;
}

async function state(orderId: string) {
  const db = await getDb();
  const [o] = await db.query<{ generation_status: string; delivery_status: string; generation_failure_code: string | null }>(
    "select generation_status, delivery_status, generation_failure_code from orders where id = $1::uuid",
    [orderId],
  );
  const [j] = await db.query<{ status: string; attempts: number }>("select status, attempts from report_jobs where order_id = $1::uuid", [orderId]);
  const parts = await db.query<{ part: string }>("select part from report_parts where order_id = $1::uuid order by part", [orderId]);
  const usage = await db.query<{ status: string }>("select status from ai_usage where order_id = $1::uuid", [orderId]);
  return { ...o!, job: j!, parts: parts.map((p) => p.part), usage: usage.map((u) => u.status) };
}

describe("report pipeline", () => {
  let ai: ScriptedAi;
  let email: CapturingEmailProvider;

  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });
  beforeEach(() => {
    ai = new ScriptedAi();
    setInterpretationProviderForTests(ai);
    email = new CapturingEmailProvider();
    setEmailProviderForTests(email);
    stubPdf();
  });
  afterEach(() => resetOverrides());

  it("runs chart -> interpretation -> PDF -> email after verified payment", async () => {
    const orderId = await paidOrder();
    const s = await state(orderId);
    expect(s).toMatchObject({ generation_status: "ready", delivery_status: "sent" });
    expect(s.parts).toEqual(["core", "synthesis", "timeline"]);
    expect(ai.calls).toHaveLength(3);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.html).toMatch(/\/access#t=[A-Za-z0-9_-]{43}/);
  });

  it("never sends the customer's name, email, phone or birthplace to the AI", async () => {
    await paidOrder();
    const payload = JSON.stringify(ai.calls.map((c) => c.input));
    expect(payload).not.toContain("Test Person");
    expect(payload).not.toContain("customer@example.com");
    expect(payload).not.toContain("9876543210");
    expect(payload).not.toContain("Chennai");
  });

  it("answers questions only when the add-on was purchased", async () => {
    await paidOrder({ questions: true });
    expect(ai.calls.find((c) => c.part === "synthesis")!.input.customer.questions).toEqual(THREE_QUESTIONS);
    ai.calls = [];
    // Even if question rows somehow existed for a report-only order, they are never answered.
    const orderId = await paidOrder({
      beforePay: async (id) => {
        await (await getDb()).query("insert into order_questions (order_id, position, question) values ($1::uuid, 1, 'Sneaky unpaid question?')", [id]);
      },
    });
    expect((await state(orderId)).generation_status).toBe("ready");
    expect(ai.calls.find((c) => c.part === "synthesis")!.input.customer.questions).toEqual([]);
  });

  it("an AI timeout is retried; completed parts are never paid for twice", async () => {
    ai.behaviours = ["ok", "timeout"]; // core ok, timeline times out
    const orderId = await paidOrder();
    let s = await state(orderId);
    expect(s.generation_status).toBe("interpreting");
    expect(s.job.status).toBe("queued");
    expect(s.parts).toEqual(["core"]);
    // Retry (the status page / sweeper would trigger this once the backoff passes).
    await (await getDb()).query("update report_jobs set lease_expires_at = now() - interval '1 second' where order_id = $1::uuid", [orderId]);
    await runGenerationLocally(orderId);
    s = await state(orderId);
    expect(s.generation_status).toBe("ready");
    expect(ai.calls.filter((c) => c.part === "core")).toHaveLength(1);
    expect(s.usage).toContain("timeout");
  });

  it("malformed AI output is rejected, retried once, and never stored", async () => {
    ai.behaviours = ["malformed", "ok"];
    const orderId = await paidOrder();
    const s = await state(orderId);
    expect(s.generation_status).toBe("ready");
    expect(s.usage.filter((u) => u === "invalid_output")).toHaveLength(1);
  });

  it("a configuration error fails permanently with a support path (no endless retries)", async () => {
    ai.behaviours = ["config"];
    const orderId = await paidOrder();
    const s = await state(orderId);
    expect(s.generation_status).toBe("failed");
    expect(s.generation_failure_code).toBe("model_not_found");
    expect(s.job.status).toBe("failed");
  });

  it("gives up after a bounded number of attempts", async () => {
    ai.behaviours = ["timeout", "timeout", "timeout", "timeout", "timeout"];
    const orderId = await paidOrder();
    for (let i = 0; i < 5; i += 1) {
      await (await getDb()).query("update report_jobs set lease_expires_at = now() - interval '1 second' where order_id = $1::uuid", [orderId]);
      await runGenerationLocally(orderId);
    }
    const s = await state(orderId);
    expect(s.generation_status).toBe("failed");
    expect(s.job.attempts).toBe(4);
  });

  it("email failure keeps the report available and records delivery as failed", async () => {
    email.failWith = new EmailSendError("provider down", true);
    const orderId = await paidOrder();
    const s = await state(orderId);
    expect(s.generation_status).toBe("ready");
    expect(s.delivery_status).toBe("failed");
    const report = await (await getDb()).query("select pdf_storage_key from reports where order_id = $1::uuid", [orderId]);
    expect(report[0]).toBeTruthy();
  });

  it("recovers when dispatch was interrupted after the payment commit", async () => {
    const created = await createOrder(orderInput({ language: "en" }), `ip-${crypto.randomUUID()}`);
    await startCheckout(created.orderId, `ip-${crypto.randomUUID()}`);
    const db = await getDb();
    const [payment] = await db.query<{ id: string; order_id: string }>("select id, order_id from payments where order_id = $1::uuid", [created.orderId]);
    // Simulate a crash right after the payment transaction: paid + job + outbox, but never dispatched.
    await db.transaction(async (tx) => {
      await tx.query("update payments set status = 'paid', verified_at = now() where id = $1::uuid", [payment!.id]);
      await tx.query("update orders set payment_status = 'paid', paid_at = now(), generation_status = 'queued' where id = $1::uuid", [created.orderId]);
      await tx.query("insert into report_jobs (order_id) values ($1::uuid)", [created.orderId]);
      await tx.query("insert into outbox (topic, order_id, dedupe_key) values ('report.generate', $1::uuid, $2)", [created.orderId, `report.generate:${created.orderId}`]);
    });
    expect((await state(created.orderId)).generation_status).toBe("queued");
    await dispatchDue({ limit: 10 }); // what the sweeper does
    expect((await state(created.orderId)).generation_status).toBe("ready");
  });
});
