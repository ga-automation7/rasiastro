import type { CompatibilityCategory } from "@/config/compatibility";
import type { LanguageCode } from "@/config/languages";
import { localDayRange, resolveLocalTime } from "@/domain/birth-time";
import { PAIR_CALCULATION_VERSION, analysePair } from "../astrology/compatibility";
import { builtInCalculationProvider } from "../astrology/provider";
import { demoPairContent, demoPartContent } from "../interpretation/demo-provider";
import { buildPairInterpretationInput } from "../interpretation/pair-input";
import { PAIR_REPORT_SCHEMA_VERSION } from "../interpretation/pair-schema";
import { validatePairPart } from "../interpretation/pair-validate";
import { buildInterpretationInput } from "../interpretation/input";
import { validatePart } from "../interpretation/validate";
import type { ReportDocument } from "./document";
import type { PairReportDocument } from "./pair-document";
import { buildSampleReport } from "./sample";

/**
 * A complete report document in any supported language, built from the sample chart
 * and the demo placeholder text. Used to verify PDF script rendering for every
 * language (npm run verify:pdf) and in automated tests.
 */
export async function buildLanguageSampleDocument(language: LanguageCode): Promise<ReportDocument> {
  const sample = await buildSampleReport();
  const input = buildInterpretationInput({
    chart: sample.chart,
    language,
    referenceDate: sample.preparedOn,
    birthDate: sample.subject.birthDate,
    periods: sample.periods,
    discrepancies: sample.discrepancies,
    knownDetails: { moonSign: "gemini", nakshatra: null, pada: null, ascendant: null, other: null },
    notes: null,
    questions: sample.questions,
  });
  return {
    ...sample,
    isDemo: true,
    language,
    orderReference: `RA-SAMPLE${language.toUpperCase()}`.slice(0, 11),
    interpretation: {
      core: validatePart("core", demoPartContent("core", input), input),
      timeline: validatePart("timeline", demoPartContent("timeline", input), input),
      synthesis: validatePart("synthesis", demoPartContent("synthesis", input), input),
      promptVersion: "demo",
      provider: "demo",
      model: "demo-sample-text",
    },
  };
}

/**
 * A complete two-person compatibility document in any language and tradition: two
 * genuinely calculated charts (one exact birth time, one unknown), the real pair
 * analysis, and validated demo placeholder text. Used by npm run verify:pdf and tests.
 */
export async function buildPairLanguageSampleDocument(language: LanguageCode, tradition: "indian" | "western", category: CompatibilityCategory = "friendship"): Promise<PairReportDocument> {
  const reference = new Date("2026-09-29T00:00:00Z");
  const chartFor = async (tz: string, date: { year: number; month: number; day: number }, time: string | null, lat: number, lon: number) => {
    const day = localDayRange(tz, date);
    const resolved = time ? resolveLocalTime(tz, date, { hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) }) : null;
    const birthUtcMs = resolved && resolved.kind === "unique" ? resolved.instant.utcMs : null;
    return builtInCalculationProvider.calculate({
      tradition,
      timeCertainty: time ? "exact" : "unknown",
      birthUtcMs,
      windowMinutes: null,
      dayStartUtcMs: day.startMs,
      dayEndUtcMs: day.endMs,
      localDate: date,
      latitude: lat,
      longitude: lon,
      timeZoneId: tz,
      referenceDate: reference,
    });
  };
  const a = await chartFor("Asia/Kolkata", { year: 1990, month: 8, day: 15 }, "06:30", 13.0827, 80.2707);
  const b = await chartFor("America/New_York", { year: 1989, month: 11, day: 2 }, null, 40.7128, -74.006);
  const analysis = analysePair(category, a.chart, b.chart);
  const input = buildPairInterpretationInput({
    language,
    category,
    referenceDate: "2026-09-29",
    analysis,
    people: [
      { chart: a.chart, birthDate: "1990-08-15", knownDetails: { moonSign: null, nakshatra: null, pada: null, ascendant: null, other: null }, discrepancies: [], notes: "Likes to plan ahead." },
      { chart: b.chart, birthDate: "1989-11-02", knownDetails: { moonSign: null, nakshatra: null, pada: null, ascendant: null, other: null }, discrepancies: [], notes: null },
    ],
    shared: { howKnown: "University friends", knownDuration: "Twelve years", hopes: null, sharedCircumstances: null },
  });
  const part = <P extends "pair_core" | "pair_dynamics" | "pair_synthesis">(p: P) => validatePairPart(p, demoPairContent(p, input), input);
  const subject = (name: string, birthDate: string, birthTime: string | null, placeLabel: string, lat: number, lon: number, tz: string, offset: string) => ({
    name,
    birthDate,
    birthTime,
    timeCertainty: birthTime ? ("exact" as const) : ("unknown" as const),
    windowMinutes: null,
    placeLabel,
    latitude: lat,
    longitude: lon,
    timezoneId: tz,
    utcOffsetLabel: offset,
  });
  return {
    schemaVersion: PAIR_REPORT_SCHEMA_VERSION,
    product: "compatibility",
    kind: "sample",
    isDemo: true,
    orderReference: `RA-PAIR${language.toUpperCase()}${tradition === "indian" ? "I" : "W"}`.slice(0, 11),
    language,
    tradition,
    category,
    preparedOn: "2026-09-29",
    people: [
      { participantId: "sample-a", subject: subject("Meera Iyer", "1990-08-15", "06:30", "Chennai, Tamil Nadu, India", 13.0827, 80.2707, "Asia/Kolkata", "UTC+05:30"), chart: a.chart, discrepancies: [], notes: "Likes to plan ahead." },
      { participantId: "sample-b", subject: subject("Sam Okafor", "1989-11-02", null, "New York, New York, United States", 40.7128, -74.006, "America/New_York", "UTC-05:00"), chart: b.chart, discrepancies: [], notes: null },
    ],
    shared: { howKnown: "University friends", knownDuration: "Twelve years", hopes: null, sharedCircumstances: null },
    calculation: { provider: a.provider, providerVersion: a.providerVersion, calculationVersion: a.calculationVersion, pairCalculationVersion: PAIR_CALCULATION_VERSION },
    analysis,
    interpretation: { pair_core: part("pair_core"), pair_dynamics: part("pair_dynamics"), pair_synthesis: part("pair_synthesis"), promptVersion: "demo", provider: "demo", model: "demo-sample-text" },
  };
}
