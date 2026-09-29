import type { LanguageCode } from "./languages";

/**
 * Customer-facing regional vocabulary. Three different things are kept apart here:
 *
 * - REPORT LANGUAGE: the language the whole report is written in (all six below).
 * - REGIONAL PERSPECTIVE: a section of every Indian report that reads the SAME
 *   calculated chart with one region's terminology, calendar and emphasis. Implemented
 *   for Tamil, Kannada and Hindi (see src/server/interpretation/perspectives.ts).
 * - CALCULATION METHOD: one for all Indian reports (sidereal, Lahiri ayanamsa,
 *   whole-sign houses, Vimshottari dasha). Languages are NOT separate sciences.
 *
 * `perspectiveIncluded` must stay false until a dedicated perspective exists in code.
 */
export interface RegionalTerm {
  language: LanguageCode;
  languageName: string;
  /** The language's own name, in its script. */
  nativeName: string;
  /** What the birth chart is commonly called, transliterated and in the script. */
  chartTerm: string;
  chartTermNative: string;
  perspectiveIncluded: boolean;
}

export const REGIONAL_TERMS: readonly RegionalTerm[] = [
  { language: "ta", languageName: "Tamil", nativeName: "தமிழ்", chartTerm: "Jathagam", chartTermNative: "ஜாதகம்", perspectiveIncluded: true },
  { language: "kn", languageName: "Kannada", nativeName: "ಕನ್ನಡ", chartTerm: "Jataka", chartTermNative: "ಜಾತಕ", perspectiveIncluded: true },
  { language: "hi", languageName: "Hindi", nativeName: "हिन्दी", chartTerm: "Janma Kundali", chartTermNative: "जन्म कुंडली", perspectiveIncluded: true },
  { language: "te", languageName: "Telugu", nativeName: "తెలుగు", chartTerm: "Jatakam", chartTermNative: "జాతకం", perspectiveIncluded: false },
  { language: "ml", languageName: "Malayalam", nativeName: "മലയാളം", chartTerm: "Jathakam", chartTermNative: "ജാതകം", perspectiveIncluded: false },
];

/** Every native-script string the site displays in the display typeface (used to subset fonts). */
export const DISPLAY_SCRIPT_TEXT = REGIONAL_TERMS.map((t) => `${t.nativeName} ${t.chartTermNative}`).join(" ");
