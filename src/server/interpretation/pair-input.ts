import { CATEGORY_ANALYSIS, getCategory, type CompatibilityCategory } from "@/config/compatibility";
import type { LanguageCode } from "@/config/languages";
import type { ChartData, Fact } from "@/domain/astrology/chart-types";
import type { IndianFactor, PairAnalysis, PersonIndex } from "@/domain/astrology/compatibility-types";
import { NAKSHATRA_NAMES_EN, PLANET_NAMES_EN, SIGN_NAMES_EN, type NakshatraKey, type SignKey } from "@/domain/astrology/constants";
import type { DiscrepancyItem } from "../reports/discrepancies";
import { buildFacts, type FactForModel } from "./input";

/**
 * What the AI sees for a compatibility report. The two people are "{{A}}" and "{{B}}":
 * no names, birthplaces, emails or phone numbers are sent. Customer notes and shared
 * context are passed as untrusted DATA and labelled as such.
 */
export const PERSON_TOKENS = ["{{A}}", "{{B}}"] as const;

export interface PairPersonForModel {
  token: (typeof PERSON_TOKENS)[number];
  ageYears: number;
  timeCertainty: string;
  facts: FactForModel[];
  knownDetails: string[];
  discrepancies: string[];
  /** "Additional information about this person" typed by the customer. */
  notes: string | null;
}

export interface PairInterpretationInput {
  kind: "pair";
  language: LanguageCode;
  tradition: "indian" | "western";
  referenceDate: string;
  category: { key: CompatibilityCategory; label: string; romantic: boolean; themes: string[] };
  conventions: string[];
  people: [PairPersonForModel, PairPersonForModel];
  pairFactors: FactForModel[];
  shared: { howKnown: string | null; knownDuration: string | null; hopes: string | null; sharedCircumstances: string | null };
}

const signIn = (s: SignKey, tradition: "indian" | "western") => (tradition === "indian" ? `${SIGN_NAMES_EN[s].sanskrit} (${SIGN_NAMES_EN[s].western})` : SIGN_NAMES_EN[s].western);

function describe<T>(fact: Fact<T>, show: (v: T) => string): { value: string; certainty: FactForModel["certainty"] } {
  if (fact.status === "known") return { value: show(fact.value), certainty: "known" };
  if (fact.status === "uncertain") return { value: `one of: ${fact.candidates.map(show).join(" / ")} (depends on the uncertain birth time)`, certainty: "uncertain" };
  return { value: "not calculated (needs an exact birth time)", certainty: "omitted" };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

function indianFactorForModel(f: IndianFactor, romantic: boolean): FactForModel {
  switch (f.key) {
    case "moon_sign_relationship":
      return {
        id: f.key,
        label: "Moon-sign (Rasi) relationship",
        ...describe(f.result, (r) =>
          `{{B}}'s Moon sign is ${ordinal(r.aToB)} from {{A}}'s, and {{A}}'s is ${ordinal(r.bToA)} from {{B}}'s (the ${r.axis} relationship)` +
          (romantic ? `; in traditional Bhakoot matching this axis is ${r.bhakootTraditionallyChallenging ? "counted as less favourable" : "not one of the less favourable axes (2/12, 5/9, 6/8)"}` : ""),
        ),
      };
    case "tara":
      return {
        id: f.key,
        label: "Tara (nakshatra count in both directions)",
        ...describe(f.result, (r) =>
          `from {{A}}'s nakshatra to {{B}}'s: ${cap(r.aToB.tara)} tara (count ${r.aToB.count}${r.aToB.traditionallyChallenging ? ", traditionally a challenging tara" : ""}); from {{B}}'s to {{A}}'s: ${cap(r.bToA.tara)} tara (count ${r.bToA.count}${r.bToA.traditionallyChallenging ? ", traditionally a challenging tara" : ""})`,
        ),
      };
    case "gana":
      return { id: f.key, label: "Gana (temperament class of the nakshatra)", ...describe(f.result, (r) => `{{A}}: ${cap(r.a)} gana; {{B}}: ${cap(r.b)} gana${r.same ? " (the same gana)" : ""}`) };
    case "graha_maitri":
      return {
        id: f.key,
        label: "Graha Maitri (natural relationship of the Moon-sign lords)",
        ...describe(f.result, (r) =>
          r.aTowardB === "same"
            ? `both Moon signs are ruled by ${PLANET_NAMES_EN[r.aLord]}`
            : `{{A}}'s Moon-sign lord ${PLANET_NAMES_EN[r.aLord]} regards {{B}}'s lord ${PLANET_NAMES_EN[r.bLord]} as ${r.aTowardB === "friend" ? "a friend" : r.aTowardB === "enemy" ? "an enemy" : "neutral"}; ${PLANET_NAMES_EN[r.bLord]} regards ${PLANET_NAMES_EN[r.aLord]} as ${r.bTowardA === "friend" ? "a friend" : r.bTowardA === "enemy" ? "an enemy" : "neutral"}`,
        ),
      };
    case "yoni":
      return {
        id: f.key,
        label: "Yoni (traditional animal symbol of the nakshatra)",
        ...describe(f.result, (r) => `{{A}}: ${r.a}; {{B}}: ${r.b}${r.relation === "same" ? " (the same yoni)" : r.relation === "traditionally_opposed" ? " (a pair traditionally described as opposed)" : ""}`),
      };
    case "nadi":
      return {
        id: f.key,
        label: "Nadi",
        ...describe(f.result, (r) => `{{A}}: ${cap(r.a)} nadi; {{B}}: ${cap(r.b)} nadi${r.same ? " (the same nadi, which traditional marriage matching treats as a caution)" : " (different nadis)"}`),
      };
  }
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}

const POINT_NAME = (p: string) => (p === "ascendant" ? "Ascendant" : PLANET_NAMES_EN[p as keyof typeof PLANET_NAMES_EN] ?? p);

export function pairFactorsForModel(analysis: PairAnalysis, romantic: boolean): FactForModel[] {
  if (analysis.kind === "indian") return analysis.factors.map((f) => indianFactorForModel(f, romantic));
  const out: FactForModel[] = analysis.interAspects.map((a, i) => ({
    id: `aspect_${i + 1}`,
    label: `{{A}}'s ${POINT_NAME(a.a)} ${a.type} {{B}}'s ${POINT_NAME(a.b)}${a.focus ? " (emphasised for this category)" : ""}`,
    value: a.certainty === "known" ? (a.orb !== null ? `orb ${a.orbApproximate ? "about " : ""}${a.orb}°` : "holds for every possible birth time") : "possible: holds for some but not all possible birth times",
    certainty: a.certainty,
  }));
  for (const o of analysis.overlays) {
    const from = PERSON_TOKENS[o.from];
    const into = PERSON_TOKENS[o.into];
    out.push({
      id: `overlay_${o.from === 0 ? "a" : "b"}_in_${o.into === 0 ? "a" : "b"}`,
      label: `Where ${from}'s planets fall in ${into}'s houses`,
      value: o.placements.map((p) => `${PLANET_NAMES_EN[p.body]}: ${describe(p.house, (h) => `house ${h}`).value}`).join("; "),
      certainty: o.placements.every((p) => p.house.status === "known") ? "known" : "uncertain",
    });
  }
  const [a, b] = analysis.people;
  out.push({
    id: "elements",
    label: "Element balance of each chart (planets with a known sign)",
    value: `{{A}}: ${JSON.stringify(a.elementBalance)}; {{B}}: ${JSON.stringify(b.elementBalance)}`,
    certainty: "known",
  });
  return out;
}

const KEY_FACTS_INDIAN = new Set(["lagna", "moon_sign", "nakshatra", "sun_sign", "planet_moon", "planet_venus", "planet_mars", "planet_mercury", "planet_jupiter", "planet_saturn"]);
const KEY_FACTS_WESTERN = new Set(["sun_sign", "moon_sign", "ascendant", "planet_venus", "planet_mars", "planet_mercury", "planet_jupiter", "planet_saturn", "elements"]);

function personFacts(chart: ChartData, index: PersonIndex): FactForModel[] {
  const keep = chart.kind === "vedic" ? KEY_FACTS_INDIAN : KEY_FACTS_WESTERN;
  const prefix = index === 0 ? "a_" : "b_";
  return buildFacts(chart)
    .filter((f) => keep.has(f.id))
    .map((f) => ({ ...f, id: `${prefix}${f.id}` }));
}

function ageAt(birthDate: string, referenceDate: string): number {
  return Number(referenceDate.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (referenceDate.slice(5) < birthDate.slice(5) ? 1 : 0);
}

function certaintyText(chart: ChartData): string {
  const w = chart.window;
  return w.certainty === "exact" ? "exact birth time" : w.certainty === "approximate" ? `approximate birth time (±${w.windowMinutes} minutes)` : "birth time unknown";
}

export interface PairPersonArgs {
  chart: ChartData;
  birthDate: string;
  knownDetails: { moonSign: SignKey | null; nakshatra: NakshatraKey | null; pada: number | null; ascendant: SignKey | null; other: string | null };
  discrepancies: DiscrepancyItem[];
  notes: string | null;
}

export interface BuildPairInputArgs {
  language: LanguageCode;
  category: CompatibilityCategory;
  referenceDate: string;
  analysis: PairAnalysis;
  people: [PairPersonArgs, PairPersonArgs];
  shared: PairInterpretationInput["shared"];
}

export function buildPairInterpretationInput(args: BuildPairInputArgs): PairInterpretationInput {
  const tradition = args.analysis.kind;
  const category = getCategory(args.category);
  const people = args.people.map((p, i) => {
    const known: string[] = [];
    const k = p.knownDetails;
    const token = PERSON_TOKENS[i]!;
    if (k.moonSign) known.push(`${token} believes their Moon sign / Rasi is ${signIn(k.moonSign, tradition)}`);
    if (k.nakshatra) known.push(`${token} believes their nakshatra is ${NAKSHATRA_NAMES_EN[k.nakshatra]}${k.pada ? ` pada ${k.pada}` : ""}`);
    if (k.ascendant) known.push(`${token} believes their ${tradition === "indian" ? "Lagna" : "Ascendant"} is ${signIn(k.ascendant, tradition)}`);
    if (k.other) known.push(`Other details shared about ${token}: ${k.other}`);
    return {
      token,
      ageYears: ageAt(p.birthDate, args.referenceDate),
      timeCertainty: certaintyText(p.chart),
      facts: personFacts(p.chart, i as PersonIndex),
      knownDetails: known,
      discrepancies: p.discrepancies.map((d) => `${d.field}: customer said ${d.customerValue}; verdict ${d.verdict}`),
      notes: p.notes,
    } satisfies PairPersonForModel;
  }) as [PairPersonForModel, PairPersonForModel];
  return {
    kind: "pair",
    language: args.language,
    tradition,
    referenceDate: args.referenceDate,
    category: { key: category.key, label: category.label, romantic: category.romantic, themes: [...CATEGORY_ANALYSIS[category.key].themes] },
    conventions: args.people[0].chart.conventions.notes,
    people,
    pairFactors: pairFactorsForModel(args.analysis, category.romantic),
    shared: args.shared,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces the people's names inside customer-written text with their placeholders, so
 * names never reach the AI even when a note mentions them ("Kavya likes to plan").
 * Matches the full name and each part of it as whole words, in any script.
 */
export function maskNames(text: string | null, people: { name: string; token: string }[]): string | null {
  if (!text) return text;
  let out = text;
  const variants = people.flatMap((p) => {
    const parts = p.name.split(/\s+/).filter((part) => part.length >= 2);
    return [p.name, ...parts].map((v) => ({ value: v.trim(), token: p.token }));
  });
  // Longest first, so "Kavya Raman" is replaced before "Kavya".
  for (const { value, token } of variants.sort((x, y) => y.value.length - x.value.length)) {
    if (!value) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{M}\\p{N}])`, "giu"), token);
  }
  return out;
}
