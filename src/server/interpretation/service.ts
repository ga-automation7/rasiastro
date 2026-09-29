import type { Product } from "@/domain/pricing";
import { getEnv } from "../config/env";
import { chooseProviders } from "../config/readiness";
import { jsonParam, type SqlExecutor } from "../db";
import { log } from "../log";
import { alertOwner } from "../ops/alerts";
import { DemoInterpretationProvider } from "./demo-provider";
import type { InterpretationInput } from "./input";
import { OpenAiInterpretationProvider } from "./openai-provider";
import type { PairInterpretationInput } from "./pair-input";
import { PAIR_PROMPT_VERSION, buildPairPrompt } from "./pair-prompt";
import { PAIR_REPORT_SCHEMA_VERSION, type PairPartContent, type PairPartName } from "./pair-schema";
import { validatePairPart } from "./pair-validate";
import { PROMPT_VERSION, buildPrompt } from "./prompt-v1";
import { AiConfigurationError, RetriableAiError, type AnyInterpretationInput, type AnyPartName, type InterpretationProvider } from "./provider";
import { REPORT_SCHEMA_VERSION, type PartContent, type PartName } from "./schema";
import { InvalidInterpretationError, validatePart } from "./validate";

let providerOverride: InterpretationProvider | null = null;
export function setInterpretationProviderForTests(provider: InterpretationProvider | null): void {
  providerOverride = provider;
}

/** The interpretation provider for a product (compatibility may use its own model). */
export function getInterpretationProvider(product: Product = "personal"): InterpretationProvider {
  if (providerOverride) return providerOverride;
  const env = getEnv();
  if (chooseProviders(env).interpretation === "demo") return new DemoInterpretationProvider();
  const model = product === "compatibility" ? (env.OPENAI_MODEL_COMPATIBILITY ?? env.OPENAI_MODEL) : env.OPENAI_MODEL;
  if (!env.OPENAI_API_KEY || !model) throw new AiConfigurationError("not_configured", "OPENAI_API_KEY and OPENAI_MODEL must be set");
  return new OpenAiInterpretationProvider({
    apiKey: env.OPENAI_API_KEY,
    model,
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

interface UsageRow {
  orderId: string;
  part: AnyPartName;
  product: Product;
  promptVersion: string;
  provider: InterpretationProvider;
  status: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  errorCode: string | null;
}

async function recordUsage(db: SqlExecutor, u: UsageRow): Promise<void> {
  await db.query(
    `insert into ai_usage (order_id, part, provider, model, prompt_version, status, input_tokens, output_tokens, latency_ms, estimated_cost_micro_usd, error_code, product)
     values ($1::uuid, $2, $3, $4, $5, $6, $7::int, $8::int, $9::int, $10::int, $11, $12)`,
    [u.orderId, u.part, u.provider.id, u.provider.model, u.promptVersion, u.status, u.inputTokens, u.outputTokens, u.latencyMs, estimateCostMicroUsd(u.inputTokens, u.outputTokens), u.errorCode, u.product],
  );
}

async function readPart<T>(db: SqlExecutor, orderId: string, part: AnyPartName): Promise<T | null> {
  const rows = await db.query<{ content: T }>(`select content from report_parts where order_id = $1::uuid and part = $2`, [orderId, part]);
  return rows[0]?.content ?? null;
}

export async function getStoredPart<P extends PartName>(db: SqlExecutor, orderId: string, part: P): Promise<PartContent<P> | null> {
  return readPart<PartContent<P>>(db, orderId, part);
}

export async function getStoredPairPart<P extends PairPartName>(db: SqlExecutor, orderId: string, part: P): Promise<PairPartContent<P> | null> {
  return readPart<PairPartContent<P>>(db, orderId, part);
}

interface GenerationSpec<T> {
  orderId: string;
  part: AnyPartName;
  product: Product;
  input: AnyInterpretationInput;
  prompt: { instructions: string; userContent: string };
  promptVersion: string;
  schemaVersion: string;
  validate: (raw: unknown) => T;
}

/**
 * Generates one report part, validates it and stores it. Idempotent: an already
 * stored part is returned without calling the AI again (a retry never pays twice).
 * An invalid response gets one immediate corrective retry; further retries are left
 * to the job runner, which bounds them.
 */
async function generateStored<T>(db: SqlExecutor, spec: GenerationSpec<T>): Promise<T> {
  const existing = await readPart<T>(db, spec.orderId, spec.part);
  if (existing) return existing;

  const provider = getInterpretationProvider(spec.product);
  const usage = (status: string, tokens: { inputTokens: number; outputTokens: number; latencyMs: number | null }, errorCode: string | null) =>
    recordUsage(db, { orderId: spec.orderId, part: spec.part, product: spec.product, promptVersion: spec.promptVersion, provider, status, ...tokens, errorCode });

  if (!provider.isDemo && (await tokensUsedToday(db)) >= getEnv().AI_DAILY_TOKEN_BUDGET) {
    await usage("budget_exceeded", { inputTokens: 0, outputTokens: 0, latencyMs: null }, "budget");
    await alertOwner("AI daily token budget reached", "Report generation is paused until usage falls below AI_DAILY_TOKEN_BUDGET. Paid orders will resume automatically; raise the budget if this is expected growth.");
    throw new AiBudgetExceededError();
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const generated = await provider.generate(spec.part, spec.prompt, spec.input);
      try {
        const content = spec.validate(generated.raw);
        await usage("success", generated, null);
        await db.query(
          `insert into report_parts (order_id, part, content, schema_version, prompt_version, provider, model, is_demo, input_tokens, output_tokens, latency_ms)
           values ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::int, $10::int, $11::int)
           on conflict (order_id, part) do nothing`,
          [spec.orderId, spec.part, jsonParam(content), spec.schemaVersion, spec.promptVersion, provider.id, provider.model, provider.isDemo, generated.inputTokens, generated.outputTokens, generated.latencyMs],
        );
        return (await readPart<T>(db, spec.orderId, spec.part))!;
      } catch (validationError) {
        await usage("invalid_output", generated, "invalid");
        throw validationError;
      }
    } catch (error) {
      lastError = error as Error;
      if (error instanceof InvalidInterpretationError && attempt < 2) {
        log.warn("AI output rejected; retrying once", { orderId: spec.orderId, part: spec.part, error });
        continue;
      }
      if (!(error instanceof InvalidInterpretationError)) {
        const code = error instanceof RetriableAiError || error instanceof AiConfigurationError ? error.code : "unknown";
        await usage(code === "timeout" ? "timeout" : "error", { inputTokens: 0, outputTokens: 0, latencyMs: null }, code);
      }
      throw error;
    }
  }
  throw lastError ?? new Error("AI generation failed");
}

/** Personal report part. */
export async function generatePart<P extends PartName>(db: SqlExecutor, orderId: string, part: P, input: InterpretationInput, priorSummary: string | null): Promise<PartContent<P>> {
  return generateStored(db, {
    orderId,
    part,
    product: "personal",
    input,
    prompt: buildPrompt(part, input, priorSummary),
    promptVersion: PROMPT_VERSION,
    schemaVersion: REPORT_SCHEMA_VERSION,
    validate: (raw) => validatePart(part, raw, input),
  });
}

/** Compatibility report part. */
export async function generatePairPart<P extends PairPartName>(
  db: SqlExecutor,
  orderId: string,
  part: P,
  input: PairInterpretationInput,
  priorSummary: string | null,
): Promise<PairPartContent<P>> {
  return generateStored(db, {
    orderId,
    part,
    product: "compatibility",
    input,
    prompt: buildPairPrompt(part, input, priorSummary),
    promptVersion: PAIR_PROMPT_VERSION,
    schemaVersion: PAIR_REPORT_SCHEMA_VERSION,
    validate: (raw) => validatePairPart(part, raw, input),
  });
}

/** Short summary of the core part passed to later parts for coherence. */
export function summariseCore(core: PartContent<"core">): string {
  return [core.overview.headline, ...core.perspectives.map((p) => `${p.key}: ${p.keyThemes.join(", ")}`)].join("\n");
}

export function summarisePairCore(core: PairPartContent<"pair_core">): string {
  return [core.overview.headline, `{{A}}: ${core.personA.keyThemes.join(", ")}`, `{{B}}: ${core.personB.keyThemes.join(", ")}`].join("\n");
}
