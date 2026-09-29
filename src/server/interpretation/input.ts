import { getLanguage, type LanguageCode } from "@/config/languages";
import type { ChartData, Fact, Placement } from "@/domain/astrology/chart-types";
import { NAKSHATRA_NAMES_EN, PLANET_NAMES_EN, SIGN_NAMES_EN, formatDegreeInSign, type NakshatraKey, type SignKey } from "@/domain/astrology/constants";
import { NAKSHATRA_KEYS } from "@/domain/astrology/constants";
import type { DiscrepancyItem } from "../reports/discrepancies";
import { currentDasha, type ReportPeriod } from "../reports/periods";
import { perspectivesFor, type PerspectiveKey } from "./perspectives";

/**
 * What the AI sees. Deliberately minimal: calculated chart facts, periods, the
 * chosen language/tradition and the customer's own notes and questions (as untrusted
 * data). No name, email, phone, payment data or birthplace is ever sent.
 */
export interface FactForModel {
  id: string;
  label: string;
  value: string;
  certainty: "known" | "uncertain" | "omitted";
}

export interface InterpretationInput {
  language: LanguageCode;
  tradition: "indian" | "western";
  referenceDate: string;
  ageYears: number;
  timeCertainty: string;
  conventions: string[];
  facts: FactForModel[];
  aspects: string[];
  periods: { id: string; when: ReportPeriod["when"]; description: string; start: string; end: string }[];
  perspectives: { key: PerspectiveKey; name: string; focus: string }[];
  customer: {
    knownDetails: string[];
    discrepancies: string[];
    notes: string | null;
    questions: string[];
  };
}

const signEn = (s: SignKey, tradition: "indian" | "western") =>
  tradition === "indian" ? `${SIGN_NAMES_EN[s].sanskrit} (${SIGN_NAMES_EN[s].western})` : SIGN_NAMES_EN[s].western;

function describeFact<T>(fact: Fact<T>, show: (v: T) => string): { value: string; certainty: FactForModel["certainty"] } {
  if (fact.status === "known") return { value: show(fact.value), certainty: "known" };
  if (fact.status === "uncertain") {
    return { value: `one of: ${fact.candidates.map(show).join(" / ")} (cannot be fixed because the birth time is uncertain)`, certainty: "uncertain" };
  }
  return { value: "not calculated (needs an exact birth time)", certainty: "omitted" };
}

function placementLine(p: Placement, tradition: "indian" | "western"): string {
  const parts = [PLANET_NAMES_EN[p.key]];
  parts.push(`in ${describeFact(p.sign, (s) => signEn(s, tradition)).value}`);
  if (p.longitude !== null && p.sign.status === "known") parts.push(`at ${formatDegreeInSign(p.longitude)}`);
  if (p.nakshatra && p.nakshatra.status === "known") parts.push(`nakshatra ${NAKSHATRA_NAMES_EN[p.nakshatra.value]}`);
  if (p.house.status === "known") parts.push(`house ${p.house.value}`);
  if (p.dignity && p.dignity.status === "known" && p.dignity.value !== "neutral") parts.push(`dignity: ${p.dignity.value.replace("_", " ")}`);
  if (p.retrograde && p.key !== "rahu" && p.key !== "ketu") parts.push("retrograde");
  return parts.join(", ");
}

export function buildFacts(chart: ChartData): FactForModel[] {
  const facts: FactForModel[] = [];
  const add = (id: string, label: string, d: { value: string; certainty: FactForModel["certainty"] }) => facts.push({ id, label, ...d });
  if (chart.kind === "vedic") {
    add("lagna", "Lagna (ascendant, sidereal)", describeFact(chart.lagna, (l) => `${signEn(l.sign, "indian")} ${formatDegreeInSign(l.longitude)}, ${NAKSHATRA_NAMES_EN[l.nakshatra]} pada ${l.pada}`));
    add("moon_sign", "Rasi (Moon sign, sidereal)", describeFact(chart.moonSign, (s) => signEn(s, "indian")));
    add("nakshatra", "Janma nakshatra (Moon's nakshatra)", describeFact(chart.moonNakshatra, (n: NakshatraKey) => NAKSHATRA_NAMES_EN[n]));
    add("pada", "Nakshatra pada", describeFact(chart.moonPada, (p) => String(p)));
    add("sun_sign", "Sun sign (sidereal)", describeFact(chart.sunSign, (s) => signEn(s, "indian")));
    add("dasha_at_birth", "Vimshottari dasha running at birth", describeFact(chart.dashaLordAtBirth, (g) => PLANET_NAMES_EN[g]));
    add("tithi", "Tithi (lunar day)", describeFact(chart.panchanga.tithi, (t) => `${t <= 15 ? "Shukla" : "Krishna"} paksha, tithi ${((t - 1) % 15) + 1}`));
    for (const g of chart.grahas) add(`planet_${g.key}`, `${PLANET_NAMES_EN[g.key]} placement`, { value: placementLine(g, "indian"), certainty: g.sign.status === "known" ? "known" : "uncertain" });
  } else {
    const sun = chart.bodies.find((b) => b.key === "sun")!;
    const moon = chart.bodies.find((b) => b.key === "moon")!;
    add("sun_sign", "Sun sign (tropical)", describeFact(sun.sign, (s) => signEn(s, "western")));
    add("moon_sign", "Moon sign (tropical)", describeFact(moon.sign, (s) => signEn(s, "western")));
    add("ascendant", "Rising sign / Ascendant", describeFact(chart.ascendant, (a) => `${signEn(a.sign, "western")} ${formatDegreeInSign(a.longitude)}`));
    add("midheaven", "Midheaven (MC)", describeFact(chart.midheaven, (a) => `${signEn(a.sign, "western")} ${formatDegreeInSign(a.longitude)}`));
    add("sect", "Day or night chart (sect)", describeFact(chart.sect, (s) => s));
    add("elements", "Element balance (planets with a known sign)", { value: JSON.stringify(chart.elementBalance), certainty: "known" });
    add("modalities", "Modality balance", { value: JSON.stringify(chart.modalityBalance), certainty: "known" });
    for (const b of chart.bodies) add(`planet_${b.key}`, `${PLANET_NAMES_EN[b.key]} placement`, { value: placementLine(b, "western"), certainty: b.sign.status === "known" ? "known" : "uncertain" });
  }
  return facts;
}

function describePeriod(p: ReportPeriod): string {
  switch (p.kind) {
    case "mahadasha":
      return `${PLANET_NAMES_EN[p.lord!]} mahadasha (major Vimshottari period)`;
    case "antardasha":
      return `${PLANET_NAMES_EN[p.lord!]} antardasha (sub-period) within ${PLANET_NAMES_EN[p.parentLord!]} mahadasha`;
    case "sade_sati":
      return "Sade Sati: Saturn transiting the 12th, 1st and 2nd signs from the natal Moon";
    case "saturn_from_moon":
      return `Saturn transiting house ${p.house} counted from the natal Moon sign`;
    case "jupiter_from_moon":
      return `Jupiter transiting house ${p.house} counted from the natal Moon sign`;
    case "transit": {
      const t = p.transit!;
      const target = t.target === "ascendant" ? "natal Ascendant" : `natal ${PLANET_NAMES_EN[t.target as keyof typeof PLANET_NAMES_EN] ?? t.target}`;
      return t.aspect === "return" ? `${PLANET_NAMES_EN[t.body]} return` : `Transiting ${PLANET_NAMES_EN[t.body]} ${t.aspect} ${target}`;
    }
  }
}

export interface BuildInputArgs {
  chart: ChartData;
  language: LanguageCode;
  referenceDate: string;
  birthDate: string;
  periods: ReportPeriod[];
  discrepancies: DiscrepancyItem[];
  knownDetails: { moonSign: SignKey | null; nakshatra: NakshatraKey | null; pada: number | null; ascendant: SignKey | null; other: string | null };
  notes: string | null;
  questions: string[];
}

export function buildInterpretationInput(args: BuildInputArgs): InterpretationInput {
  const { chart } = args;
  const tradition = chart.kind === "vedic" ? "indian" : "western";
  const birthYear = Number(args.birthDate.slice(0, 4));
  const ageYears = Number(args.referenceDate.slice(0, 4)) - birthYear - (args.referenceDate.slice(5) < args.birthDate.slice(5) ? 1 : 0);
  const window = chart.window;
  const timeCertainty =
    window.certainty === "exact" ? "exact birth time" : window.certainty === "approximate" ? `approximate birth time (±${window.windowMinutes} minutes)` : "birth time unknown";
  const dasha = currentDasha(chart, args.referenceDate);
  const facts = buildFacts(chart);
  if (dasha) {
    facts.push({
      id: "current_dasha",
      label: "Current Vimshottari period",
      value: `${PLANET_NAMES_EN[dasha.maha.lord]} mahadasha (${dasha.maha.start} to ${dasha.maha.end})${dasha.antar ? `, ${PLANET_NAMES_EN[dasha.antar.lord]} antardasha (${dasha.antar.start} to ${dasha.antar.end})` : ""}`,
      certainty: chart.kind === "vedic" && chart.dasha.status === "known" ? "known" : "uncertain",
    });
  }
  const known: string[] = [];
  const k = args.knownDetails;
  if (k.moonSign) known.push(`Customer believes their Moon sign / Rasi is ${signEn(k.moonSign, tradition)}`);
  if (k.nakshatra) known.push(`Customer believes their nakshatra is ${NAKSHATRA_NAMES_EN[k.nakshatra]}${k.pada ? ` pada ${k.pada}` : ""}`);
  if (k.ascendant) known.push(`Customer believes their ${tradition === "indian" ? "Lagna" : "Ascendant"} is ${signEn(k.ascendant, tradition)}`);
  if (k.other) known.push(`Other details the customer shared: ${k.other}`);

  const discrepancies = args.discrepancies.map((d) => {
    const show = (v: string) => (d.field === "nakshatra" ? NAKSHATRA_NAMES_EN[v as NakshatraKey] ?? v : d.field === "pada" ? v : SIGN_NAMES_EN[v as SignKey] ? signEn(v as SignKey, tradition) : v);
    const calculated = d.verdict === "unverifiable" ? "cannot be calculated without an exact birth time" : d.candidates.length ? `one of ${d.candidates.map(show).join(" / ")}` : show(d.calculatedValue ?? "");
    return `${d.field}: customer said ${show(d.customerValue)}; calculation gives ${calculated}; verdict: ${d.verdict}`;
  });

  return {
    language: args.language,
    tradition,
    referenceDate: args.referenceDate,
    ageYears,
    timeCertainty,
    conventions: chart.conventions.notes,
    facts,
    aspects:
      chart.kind === "western"
        ? [...chart.aspects].sort((a, b) => a.orb - b.orb).slice(0, 12).map((a) => `${a.a} ${a.type} ${a.b} (orb ${a.orb}°)`)
        : [],
    periods: args.periods.map((p) => ({ id: p.id, when: p.when, description: describePeriod(p), start: p.start, end: p.end })),
    perspectives: perspectivesFor(tradition).map((p) => ({ key: p.key, name: p.name, focus: p.focus })),
    customer: { knownDetails: known, discrepancies, notes: args.notes, questions: args.questions },
  };
}

export function languageInstruction(code: LanguageCode): string {
  const language = getLanguage(code);
  return code === "en" ? "English" : `${language.englishName} (${language.nativeName}), written in the ${language.script} script`;
}

export const ALL_NAKSHATRAS = NAKSHATRA_KEYS;
