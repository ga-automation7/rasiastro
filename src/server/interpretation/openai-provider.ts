import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { PAIR_PART_SCHEMAS, isPairPart } from "./pair-schema";
import { PART_SCHEMAS } from "./schema";
import { AiConfigurationError, RetriableAiError, type AnyPartName, type GeneratedPart, type InterpretationProvider } from "./provider";
import { InvalidInterpretationError } from "./validate";

/**
 * OpenAI adapter using the Responses API with structured outputs
 * (`responses.parse` + `zodTextFormat`, openai-node v7).
 *
 * - The model comes from OPENAI_MODEL; `npm run config:check` confirms the account can
 *   use it. No model name is assumed.
 * - The SDK's own retries are disabled; retries are bounded by the job runner.
 * - `store: false` asks OpenAI not to retain the response for later retrieval.
 */
export interface OpenAiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
}

export class OpenAiInterpretationProvider implements InterpretationProvider {
  readonly id = "openai" as const;
  readonly isDemo = false;
  readonly model: string;
  private readonly client: OpenAI;
  private readonly config: OpenAiConfig;

  constructor(config: OpenAiConfig) {
    this.config = config;
    this.model = config.model;
    this.client = new OpenAI({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 0 });
  }

  async generate(part: AnyPartName, prompt: { instructions: string; userContent: string }): Promise<GeneratedPart> {
    const schema = isPairPart(part) ? PAIR_PART_SCHEMAS[part] : PART_SCHEMAS[part];
    const started = Date.now();
    try {
      const response = await this.client.responses.parse({
        model: this.config.model,
        instructions: prompt.instructions,
        input: prompt.userContent,
        text: { format: zodTextFormat(schema, `rasi_astro_${part}`) },
        max_output_tokens: this.config.maxOutputTokens,
        store: false,
        ...(this.config.reasoningEffort ? { reasoning: { effort: this.config.reasoningEffort } } : {}),
      });
      const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
      if (response.status === "incomplete") {
        throw new InvalidInterpretationError(`Response incomplete: ${response.incomplete_details?.reason ?? "unknown"}`);
      }
      if (response.output_parsed === null) throw new InvalidInterpretationError("Model returned no parsable output (possibly a refusal)");
      return { raw: response.output_parsed, ...usage, latencyMs: Date.now() - started };
    } catch (error) {
      throw classify(error);
    }
  }
}

function classify(error: unknown): Error {
  if (error instanceof InvalidInterpretationError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new RetriableAiError("timeout", "AI request timed out");
  if (error instanceof OpenAI.APIConnectionError) return new RetriableAiError("connection", "Could not reach the AI provider");
  if (error instanceof OpenAI.RateLimitError) return new RetriableAiError("rate_limited", "AI provider rate limit");
  if (error instanceof OpenAI.InternalServerError) return new RetriableAiError("provider_error", "AI provider error");
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AiConfigurationError("auth", "OpenAI rejected the API key or the model is not permitted for this account");
  }
  if (error instanceof OpenAI.NotFoundError) return new AiConfigurationError("model_not_found", "The configured OPENAI_MODEL is not available to this account");
  if (error instanceof OpenAI.BadRequestError) return new AiConfigurationError("bad_request", `OpenAI rejected the request: ${error.message.slice(0, 200)}`);
  if (error instanceof Error && /zod|parse/i.test(error.message)) return new InvalidInterpretationError(error.message);
  return error instanceof Error ? new RetriableAiError("unknown", error.message) : new RetriableAiError("unknown", "Unknown AI error");
}
