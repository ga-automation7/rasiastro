import { z } from "zod";

/**
 * Structured output requested from the AI, one schema per report part. Parts are
 * generated and stored separately so a retry never repeats a completed (paid-for)
 * AI call, and each call stays well inside token and time limits.
 *
 * The JSON schema sent to the model deliberately has no length/count constraints
 * (structured-output support for those varies); `validatePart` enforces them after
 * the response arrives, and an invalid response is retried a bounded number of times.
 *
 * Bump REPORT_SCHEMA_VERSION whenever these shapes change.
 */
export const REPORT_SCHEMA_VERSION = "report-schema-1";

const paragraphs = z.array(z.string());

export const CorePartSchema = z.object({
  overview: z.object({ headline: z.string(), paragraphs }),
  chartExplanations: z.array(z.object({ factId: z.string(), explanation: z.string() })),
  perspectives: z.array(z.object({ key: z.string(), paragraphs, keyThemes: z.array(z.string()) })),
});

export const TimelinePartSchema = z.object({
  lookingBack: z.object({ intro: z.string(), periods: z.array(z.object({ periodId: z.string(), paragraphs })) }),
  lookingAhead: z.object({
    intro: z.string(),
    periods: z.array(z.object({ periodId: z.string(), paragraphs, opportunities: z.array(z.string()), challenges: z.array(z.string()) })),
  }),
  lifeAreas: z.object({ career: paragraphs, relationships: paragraphs, personalGrowth: paragraphs, money: paragraphs }),
});

export const SynthesisPartSchema = z.object({
  agreements: z.array(z.string()),
  differences: z.array(z.string()),
  combinedSummary: paragraphs,
  contextResponse: z.string(),
  questionAnswers: z.array(z.object({ questionNumber: z.number().int(), answer: paragraphs })),
});

export type CorePart = z.infer<typeof CorePartSchema>;
export type TimelinePart = z.infer<typeof TimelinePartSchema>;
export type SynthesisPart = z.infer<typeof SynthesisPartSchema>;

export type PartName = "core" | "timeline" | "synthesis";
export const PART_SCHEMAS = { core: CorePartSchema, timeline: TimelinePartSchema, synthesis: SynthesisPartSchema } as const;
export type PartContent<P extends PartName> = z.infer<(typeof PART_SCHEMAS)[P]>;

export interface InterpretationParts {
  core: CorePart;
  timeline: TimelinePart;
  synthesis: SynthesisPart;
}
