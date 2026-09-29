import type { LanguageCode } from "@/config/languages";
import type { InterpretationInput } from "./input";
import { PART_SCHEMAS, type PartContent, type PartName } from "./schema";

/**
 * Semantic validation of AI output, beyond JSON shape: the right sections, the right
 * ids, sensible lengths, the right question count, and text actually written in the
 * requested script. Anything that fails is rejected and regenerated (bounded retries).
 */
export class InvalidInterpretationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInterpretationError";
  }
}

const SCRIPT_RANGES: Record<LanguageCode, RegExp> = {
  en: /[A-Za-z]/g,
  ta: /[஀-௿]/g,
  hi: /[ऀ-ॿ]/g,
  te: /[ఀ-౿]/g,
  kn: /[ಀ-೿]/g,
  ml: /[ഀ-ൿ]/g,
};

/** Share of letters in the expected script (ignores digits, punctuation, spaces). */
export function scriptShare(text: string, language: LanguageCode): number {
  const letters = text.match(/\p{L}|\p{M}/gu)?.length ?? 0;
  if (letters === 0) return 1;
  const inScript = text.match(SCRIPT_RANGES[language])?.length ?? 0;
  return inScript / letters;
}

function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectText(v, out));
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "key" || key === "factId" || key === "periodId") continue;
      collectText(v, out);
    }
  }
  return out;
}

function require(condition: boolean, message: string): void {
  if (!condition) throw new InvalidInterpretationError(message);
}

const nonEmpty = (list: string[], min: number, max: number, label: string) => {
  require(list.length >= min && list.length <= max, `${label}: expected ${min}-${max} items, got ${list.length}`);
  require(list.every((p) => p.trim().length >= 10), `${label}: empty or too-short text`);
};

export function validatePart<P extends PartName>(part: P, raw: unknown, input: InterpretationInput): PartContent<P> {
  const parsed = PART_SCHEMAS[part].safeParse(raw);
  if (!parsed.success) throw new InvalidInterpretationError(`Schema mismatch: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  const content = parsed.data as PartContent<P>;

  if (part === "core") {
    const core = content as PartContent<"core">;
    require(core.overview.headline.trim().length > 3, "overview.headline missing");
    nonEmpty(core.overview.paragraphs, 2, 5, "overview.paragraphs");
    const factIds = new Set(input.facts.map((f) => f.id));
    require(core.chartExplanations.length >= 3 && core.chartExplanations.length <= 14, "chartExplanations count");
    require(core.chartExplanations.every((e) => factIds.has(e.factId)), "chartExplanations: unknown factId");
    const expectedKeys = input.perspectives.map((p) => p.key).join(",");
    require(core.perspectives.map((p) => p.key).join(",") === expectedKeys, `perspectives must be exactly ${expectedKeys}`);
    core.perspectives.forEach((p) => {
      nonEmpty(p.paragraphs, 2, 5, `perspective ${p.key}`);
      require(p.keyThemes.length >= 1 && p.keyThemes.length <= 6, `perspective ${p.key} keyThemes`);
    });
  }

  if (part === "timeline") {
    const timeline = content as PartContent<"timeline">;
    const past = new Set(input.periods.filter((p) => p.when === "past").map((p) => p.id));
    const ahead = new Set(input.periods.filter((p) => p.when !== "past").map((p) => p.id));
    require(timeline.lookingBack.intro.trim().length > 10, "lookingBack.intro missing");
    require(timeline.lookingAhead.intro.trim().length > 10, "lookingAhead.intro missing");
    require(timeline.lookingBack.periods.every((p) => past.has(p.periodId)), "lookingBack: unknown or non-past periodId");
    require(timeline.lookingAhead.periods.every((p) => ahead.has(p.periodId)), "lookingAhead: unknown or past periodId");
    require(timeline.lookingAhead.periods.length >= Math.min(1, ahead.size), "lookingAhead: no periods covered");
    timeline.lookingBack.periods.forEach((p) => nonEmpty(p.paragraphs, 1, 3, "lookingBack period"));
    timeline.lookingAhead.periods.forEach((p) => nonEmpty(p.paragraphs, 1, 3, "lookingAhead period"));
    for (const area of ["career", "relationships", "personalGrowth", "money"] as const) nonEmpty(timeline.lifeAreas[area], 1, 4, `lifeAreas.${area}`);
  }

  if (part === "synthesis") {
    const synthesis = content as PartContent<"synthesis">;
    require(synthesis.agreements.length >= 1 && synthesis.agreements.length <= 6, "agreements count");
    require(synthesis.differences.length <= 6, "differences count");
    nonEmpty(synthesis.combinedSummary, 2, 5, "combinedSummary");
    const expected = input.customer.questions.length;
    require(synthesis.questionAnswers.length === expected, `questionAnswers: expected ${expected}, got ${synthesis.questionAnswers.length}`);
    const numbers = synthesis.questionAnswers.map((q) => q.questionNumber).sort().join(",");
    require(numbers === Array.from({ length: expected }, (_, i) => i + 1).join(","), "questionAnswers: wrong question numbers");
    synthesis.questionAnswers.forEach((q) => nonEmpty(q.answer, 1, 4, `answer ${q.questionNumber}`));
  }

  const text = collectText(content).join(" ");
  const share = scriptShare(text, input.language);
  require(share >= (input.language === "en" ? 0.9 : 0.6), `Text is not in the requested language/script (share ${share.toFixed(2)})`);
  return content;
}
