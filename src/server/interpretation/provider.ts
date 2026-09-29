import type { PartName } from "./schema";
import type { InterpretationInput } from "./input";

export interface GeneratedPart {
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * AI interpretation boundary. Providers turn validated chart data into prose; they
 * never compute chart facts. Swap providers by implementing this interface.
 */
export interface InterpretationProvider {
  readonly id: "openai" | "demo";
  readonly model: string;
  readonly isDemo: boolean;
  generate(part: PartName, prompt: { instructions: string; userContent: string }, input: InterpretationInput): Promise<GeneratedPart>;
}

/** A failure worth retrying later (timeouts, rate limits, provider outages). */
export class RetriableAiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RetriableAiError";
    this.code = code;
  }
}

/** A configuration problem (bad key, unknown model) - retrying will not help. */
export class AiConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AiConfigurationError";
    this.code = code;
  }
}
