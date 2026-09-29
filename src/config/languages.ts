/**
 * Report languages. Language is independent of astrology tradition: any language can
 * be combined with either the Indian or the Western tradition.
 *
 * `enabled` controls whether customers can buy a report in this language. Only set it
 * to true after `npm run verify:pdf` passes for the language (the PDF must embed a
 * font with correct script shaping). `translationReview` records whether a native
 * speaker has reviewed the fixed report labels in src/i18n.
 */
export const REPORT_LANGUAGES = [
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்", script: "Tamil", htmlLang: "ta", enabled: true, translationReview: "pending" },
  { code: "en", englishName: "English", nativeName: "English", script: "Latin", htmlLang: "en", enabled: true, translationReview: "done" },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", script: "Devanagari", htmlLang: "hi", enabled: true, translationReview: "pending" },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు", script: "Telugu", htmlLang: "te", enabled: true, translationReview: "pending" },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", htmlLang: "kn", enabled: true, translationReview: "pending" },
  { code: "ml", englishName: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", htmlLang: "ml", enabled: true, translationReview: "pending" },
] as const;

export type LanguageCode = (typeof REPORT_LANGUAGES)[number]["code"];
export type ScriptName = (typeof REPORT_LANGUAGES)[number]["script"];

export const LANGUAGE_CODES = REPORT_LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export function getLanguage(code: LanguageCode) {
  const language = REPORT_LANGUAGES.find((l) => l.code === code);
  if (!language) throw new Error(`Unknown language ${code}`);
  return language;
}

export function isLanguageEnabled(code: LanguageCode): boolean {
  return getLanguage(code).enabled;
}

export const TRADITIONS = [
  {
    code: "indian",
    title: "Indian (Vedic) astrology",
    shortTitle: "Indian",
    description:
      "Sidereal zodiac (Lahiri ayanamsa), your Rasi, Nakshatram and Lagna, Vimshottari dasha periods, with Tamil, Kannada and North Indian presentation perspectives.",
  },
  {
    code: "western",
    title: "Western astrology",
    shortTitle: "Western",
    description:
      "The tropical zodiac used in European and American astrology: Sun, Moon and Rising signs, houses and planetary aspects, read from modern and traditional perspectives.",
  },
] as const;

export type TraditionCode = (typeof TRADITIONS)[number]["code"];
export const TRADITION_CODES = TRADITIONS.map((t) => t.code) as [TraditionCode, ...TraditionCode[]];
