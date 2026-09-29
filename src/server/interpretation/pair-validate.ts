import type { PairInterpretationInput } from "./pair-input";
import { PAIR_PART_SCHEMAS, type PairPartContent, type PairPartName } from "./pair-schema";
import { InvalidInterpretationError, scriptShare } from "./validate";

/**
 * Semantic validation of compatibility output: the right sections and ids, sensible
 * lengths, the two placeholders used (and no invented names in their place), no
 * scores or percentages, and text in the requested script.
 */
function require(condition: boolean, message: string): void {
  if (!condition) throw new InvalidInterpretationError(message);
}

const nonEmpty = (list: string[], min: number, max: number, label: string) => {
  require(list.length >= min && list.length <= max, `${label}: expected ${min}-${max} items, got ${list.length}`);
  require(list.every((p) => p.trim().length >= 10), `${label}: empty or too-short text`);
};

function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectText(v, out));
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "factorId" || key === "themeNumber") continue;
      collectText(v, out);
    }
  }
  return out;
}

/** A percentage or an "x out of y" / "x/36" style score. */
const SCORE_PATTERN = /\d+(?:[.,]\d+)?\s*(?:%|٪|percent|प्रतिशत)|\b\d+\s*(?:\/|out of)\s*(?:10|36|100)\b/i;

export function validatePairPart<P extends PairPartName>(part: P, raw: unknown, input: PairInterpretationInput): PairPartContent<P> {
  const parsed = PAIR_PART_SCHEMAS[part].safeParse(raw);
  if (!parsed.success) throw new InvalidInterpretationError(`Schema mismatch: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  const content = parsed.data as PairPartContent<P>;

  if (part === "pair_core") {
    const core = content as PairPartContent<"pair_core">;
    require(core.overview.headline.trim().length > 3, "overview.headline missing");
    nonEmpty(core.overview.paragraphs, 1, 4, "overview.paragraphs");
    nonEmpty(core.personA.paragraphs, 1, 3, "personA.paragraphs");
    nonEmpty(core.personB.paragraphs, 1, 3, "personB.paragraphs");
    require(core.personA.keyThemes.length >= 1 && core.personA.keyThemes.length <= 6, "personA.keyThemes");
    require(core.personB.keyThemes.length >= 1 && core.personB.keyThemes.length <= 6, "personB.keyThemes");
    const ids = new Set(input.pairFactors.filter((f) => f.certainty !== "omitted").map((f) => f.id));
    require(core.factorExplanations.every((e) => ids.has(e.factorId)), "factorExplanations: unknown or omitted factorId");
    require(core.factorExplanations.length >= Math.min(ids.size, 3), "factorExplanations: too few factors explained");
    const text = collectText(core).join(" ");
    require(text.includes("{{A}}") && text.includes("{{B}}"), "Both placeholders {{A}} and {{B}} must be used");
  }

  if (part === "pair_dynamics") {
    const d = content as PairPartContent<"pair_dynamics">;
    nonEmpty(d.communication, 1, 3, "communication");
    nonEmpty(d.sharedStrengths.paragraphs, 1, 3, "sharedStrengths.paragraphs");
    require(d.sharedStrengths.points.length >= 2 && d.sharedStrengths.points.length <= 6, "sharedStrengths.points");
    nonEmpty(d.potentialFriction.paragraphs, 1, 3, "potentialFriction.paragraphs");
    require(d.potentialFriction.points.length >= 1 && d.potentialFriction.points.length <= 5, "potentialFriction.points");
    const expected = input.category.themes.length;
    require(d.categoryFocus.length === expected, `categoryFocus: expected ${expected}, got ${d.categoryFocus.length}`);
    require(d.categoryFocus.map((t) => t.themeNumber).join(",") === Array.from({ length: expected }, (_, i) => i + 1).join(","), "categoryFocus: wrong theme numbers");
    d.categoryFocus.forEach((t) => {
      require(t.title.trim().length > 1, "categoryFocus title missing");
      nonEmpty(t.paragraphs, 1, 3, `categoryFocus ${t.themeNumber}`);
    });
  }

  if (part === "pair_synthesis") {
    const s = content as PairPartContent<"pair_synthesis">;
    nonEmpty(s.summary, 1, 4, "summary");
    require(s.discussTogether.length >= 3 && s.discussTogether.length <= 7, "discussTogether count");
    require(s.discussTogether.every((q) => q.trim().length >= 8), "discussTogether: too-short prompt");
  }

  const all = collectText(content).join(" ");
  // Stray placeholders (anything other than {{A}}/{{B}}) mean the model improvised.
  require(!/\{\{(?![AB]\}\})[^}]*\}\}/.test(all), "Unknown placeholder in text");
  require(!SCORE_PATTERN.test(all), "Scores and percentages are not allowed in compatibility reports");
  const share = scriptShare(all.replace(/\{\{[AB]\}\}/g, ""), input.language);
  require(share >= (input.language === "en" ? 0.9 : 0.6), `Text is not in the requested language/script (share ${share.toFixed(2)})`);
  return content;
}
