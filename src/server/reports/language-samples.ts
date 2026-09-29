import type { LanguageCode } from "@/config/languages";
import { demoPartContent } from "../interpretation/demo-provider";
import { buildInterpretationInput } from "../interpretation/input";
import { validatePart } from "../interpretation/validate";
import type { ReportDocument } from "./document";
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
