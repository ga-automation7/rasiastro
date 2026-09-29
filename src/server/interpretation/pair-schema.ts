import { z } from "zod";

/**
 * Structured AI output for a compatibility (two-person) report, generated in three
 * separately stored parts like the personal report. The two people are referred to
 * ONLY by the placeholders {{A}} and {{B}}; real names are never sent to the AI and
 * are substituted when the report is rendered.
 *
 * Bump PAIR_REPORT_SCHEMA_VERSION whenever these shapes change.
 */
export const PAIR_REPORT_SCHEMA_VERSION = "pair-report-schema-1";

const paragraphs = z.array(z.string());

export const PairCorePartSchema = z.object({
  overview: z.object({ headline: z.string(), paragraphs }),
  personA: z.object({ paragraphs, keyThemes: z.array(z.string()) }),
  personB: z.object({ paragraphs, keyThemes: z.array(z.string()) }),
  factorExplanations: z.array(z.object({ factorId: z.string(), explanation: z.string() })),
});

export const PairDynamicsPartSchema = z.object({
  communication: paragraphs,
  sharedStrengths: z.object({ paragraphs, points: z.array(z.string()) }),
  potentialFriction: z.object({ paragraphs, points: z.array(z.string()) }),
  categoryFocus: z.array(z.object({ themeNumber: z.number().int(), title: z.string(), paragraphs })),
});

export const PairSynthesisPartSchema = z.object({
  summary: paragraphs,
  discussTogether: z.array(z.string()),
  contextResponse: z.string(),
  limitations: z.string(),
});

export type PairCorePart = z.infer<typeof PairCorePartSchema>;
export type PairDynamicsPart = z.infer<typeof PairDynamicsPartSchema>;
export type PairSynthesisPart = z.infer<typeof PairSynthesisPartSchema>;

export type PairPartName = "pair_core" | "pair_dynamics" | "pair_synthesis";
export const PAIR_PART_SCHEMAS = { pair_core: PairCorePartSchema, pair_dynamics: PairDynamicsPartSchema, pair_synthesis: PairSynthesisPartSchema } as const;
export type PairPartContent<P extends PairPartName> = z.infer<(typeof PAIR_PART_SCHEMAS)[P]>;

export interface PairInterpretationParts {
  pair_core: PairCorePart;
  pair_dynamics: PairDynamicsPart;
  pair_synthesis: PairSynthesisPart;
}

export function isPairPart(part: string): part is PairPartName {
  return part === "pair_core" || part === "pair_dynamics" || part === "pair_synthesis";
}
