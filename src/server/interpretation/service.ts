import { getEnv } from "../config/env";
import { chooseProviders } from "../config/readiness";
import { jsonParam, type SqlExecutor } from "../db";
import { log } from "../log";
import { alertOwner } from "../ops/alerts";
import { DemoInterpretationProvider } from "./demo-provider";
import type { InterpretationInput } from "./input";
import { OpenAiInterpretationProvider } from "./openai-provider";
import { PROMPT_VERSION, buildPrompt } from "./prompt-v1";
import { AiConfigurationError, RetriableAiError, type InterpretationProvider } from "./provider";
import { REPORT_SCHEMA_VERSION, type PartContent, type PartName } from "./schema";
import { InvalidInterpretationError, validatePart } from "./validate";

let providerOverride: InterpretationProvider | null = null;
export function setInterpretationProviderForTests(provider: InterpretationProvider | null): void {
  providerOverride = provider;
}

export function getInterpretationProvider(): InterpretationProvider {
  if (providerOverride) return providerOverride;
  const env = getEnv();
  if (chooseProviders(env).interpretation === "demo") return new DemoInterpretationProvider();
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) throw new AiConfigurationError("not_configured", "OPENAI_API_KEY and OPENAI_MODEL must be set");
  return new OpenAiInterpretationProvider({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    reasoningEffort: env.OPENAI_REASONING_EFFORT,
  });
}

export class AiBudgetExceededError extends RetriableAiError {
  constructor() {
    super("budget_exceeded", "Daily AI token budget reached; generation will resume later");
  }
}

async function tokensUsedToday(db: SqlExecutor): Promise<number> {
  const rows = await db.query<{ total: number }>(
    `select coalesce(sum(input_tokens + output_tokens), 0)::int as total from ai_usage where created_at > now() - interval '24 hours'`,
  );
  return rows[0]?.total ?? 0;
}

function estimateCostMicroUsd(inputTokens: number, outputTokens: number): number | null {
  const env = getEnv();
  if (env.AI_PRICE_INPUT_PER_MTOK_USD === undefined || env.AI_PRICE_OUTPUT_PER_MTOK_USD === undefined) return null;
  return Math.round(inputTokens * env.AI_PRICE_INPUT_PER_MTOK_USD + outputTokens * env.AI_PRICE_OUTPUT_PER_MTOK_USD);
}

async function recordUsage(
  db: SqlExecutor,
  u: { orderId: string; part: PartName; provider: InterpretationProvider; status: string; inputTokens: number; outputTokens: number; latencyMs: number | null; errorCode: string | null },
): Promise<void> {
  await db.query(
    `insert into ai_usage (order_id, part, provider, model, prompt_version, status, input_tokens, output_tokens, latency_ms, estimated_cost_micro_usd, error_code)
     values ($1::uuid, $2, $3, $4, $5, $6, $7::int, $8::int, $9::int, $10::int, $11)`,
    [u.orderId, u.part, u.provider.id, u.provider.model, PROMPT_VERSION, u.status, u.inputTokens, u.outputTokens, u.latencyMs, estimateCostMicroUsd(u.inputTokens, u.outputTokens), u.errorCode],
  );
}

export async function getStoredPart<P extends PartName>(db: SqlExecutor, orderId: string, part: P): Promise<PartContent<P> | null> {
  const rows = await db.query<{ content: PartContent<P> }>(`select content from report_parts where order_id = $1::uuid and part = $2`, [orderId, part]);
  return rows[0]?.content ?? null;
}

/**
 * Generates one report part, validates it and stores it. Idempotent: an already
 * stored part is returned without calling the AI again. An invalid response gets one
 * immediate corrective retry; further retries are left to the job runner.
 */
export async function generatePart<P extends PartName>(
  db: SqlExecutor,
  orderId: string,
  part: P,
  input: InterpretationInput,
  priorSummary: string | null,
): Promise<PartContent<P>> {
  const existing = await getStoredPart(db, orderId, part);
  if (existing) return existing;

  const provider = getInterpretationProvider();
  if (!provider.isDemo && (await tokensUsedToday(db)) >= getEnv().AI_DAILY_TOKEN_BUDGET) {
    await recordUsage(db, { orderId, part, provider, status: "budget_exceeded", inputTokens: 0, outputTokens: 0, latencyMs: null, errorCode: "budget" });
    await alertOwner("AI daily token budget reached", "Report generation is paused until usage falls below AI_DAILY_TOKEN_BUDGET. Paid orders will resume automatically; raise the budget if this is expected growth.");
    throw new AiBudgetExceededError();
  }

  const prompt = buildPrompt(part, input, priorSummary);
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const generated = await provider.generate(part, prompt, input);
      try {
        const content = validatePart(part, generated.raw, input);
        await recordUsage(db, { orderId, part, provider, status: "success", inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, latencyMs: generated.latencyMs, errorCode: null });
        await db.query(
          `insert into report_parts (order_id, part, content, schema_version, prompt_version, provider, model, is_demo, input_tokens, output_tokens, latency_ms)
           values ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::int, $10::int, $11::int)
           on conflict (order_id, part) do nothing`,
          [orderId, part, jsonParam(content), REPORT_SCHEMA_VERSION, PROMPT_VERSION, provider.id, provider.model, provider.isDemo, generated.inputTokens, generated.outputTokens, generated.latencyMs],
        );
        return (await getStoredPart(db, orderId, part))!;
      } catch (validationError) {
        await recordUsage(db, { orderId, part, provider, status: "invalid_output", inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, latencyMs: generated.latencyMs, errorCode: "invalid" });
        throw validationError;
      }
    } catch (error) {
      lastError = error as Error;
      if (error instanceof InvalidInterpretationError && attempt < 2) {
        log.warn("AI output rejected; retrying once", { orderId, part, error });
        continue;
      }
      if (!(error instanceof InvalidInterpretationError)) {
        const code = error instanceof RetriableAiError || error instanceof AiConfigurationError ? error.code : "unknown";
        await recordUsage(db, { orderId, part, provider, status: code === "timeout" ? "timeout" : "error", inputTokens: 0, outputTokens: 0, latencyMs: null, errorCode: code });
      }
      throw error;
    }
  }
  throw lastError ?? new Error("AI generation failed");
}

/** Short summary of the core part passed to later parts for coherence. */
export function summariseCore(core: PartContent<"core">): string {
  return [core.overview.headline, ...core.perspectives.map((p) => `${p.key}: ${p.keyThemes.join(", ")}`)].join("\n");
}
