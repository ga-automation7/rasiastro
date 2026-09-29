/** Shared zodiac vocabulary. Keys are stable identifiers stored in the database. */

export const SIGN_KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const;
export type SignKey = (typeof SIGN_KEYS)[number];

/** English (Western) names and the Sanskrit rasi names commonly written in English. */
export const SIGN_NAMES_EN: Record<SignKey, { western: string; sanskrit: string }> = {
  aries: { western: "Aries", sanskrit: "Mesha" },
  taurus: { western: "Taurus", sanskrit: "Vrishabha" },
  gemini: { western: "Gemini", sanskrit: "Mithuna" },
  cancer: { western: "Cancer", sanskrit: "Karka" },
  leo: { western: "Leo", sanskrit: "Simha" },
  virgo: { western: "Virgo", sanskrit: "Kanya" },
  libra: { western: "Libra", sanskrit: "Tula" },
  scorpio: { western: "Scorpio", sanskrit: "Vrischika" },
  sagittarius: { western: "Sagittarius", sanskrit: "Dhanu" },
  capricorn: { western: "Capricorn", sanskrit: "Makara" },
  aquarius: { western: "Aquarius", sanskrit: "Kumbha" },
  pisces: { western: "Pisces", sanskrit: "Meena" },
};

export const NAKSHATRA_KEYS = [
  "ashwini",
  "bharani",
  "krittika",
  "rohini",
  "mrigashira",
  "ardra",
  "punarvasu",
  "pushya",
  "ashlesha",
  "magha",
  "purva_phalguni",
  "uttara_phalguni",
  "hasta",
  "chitra",
  "swati",
  "vishakha",
  "anuradha",
  "jyeshtha",
  "mula",
  "purva_ashadha",
  "uttara_ashadha",
  "shravana",
  "dhanishta",
  "shatabhisha",
  "purva_bhadrapada",
  "uttara_bhadrapada",
  "revati",
] as const;
export type NakshatraKey = (typeof NAKSHATRA_KEYS)[number];

export const NAKSHATRA_NAMES_EN: Record<NakshatraKey, string> = {
  ashwini: "Ashwini",
  bharani: "Bharani",
  krittika: "Krittika",
  rohini: "Rohini",
  mrigashira: "Mrigashira",
  ardra: "Ardra (Thiruvathirai)",
  punarvasu: "Punarvasu",
  pushya: "Pushya (Poosam)",
  ashlesha: "Ashlesha (Ayilyam)",
  magha: "Magha (Magam)",
  purva_phalguni: "Purva Phalguni (Pooram)",
  uttara_phalguni: "Uttara Phalguni (Uthiram)",
  hasta: "Hasta",
  chitra: "Chitra",
  swati: "Swati",
  vishakha: "Vishakha",
  anuradha: "Anuradha (Anusham)",
  jyeshtha: "Jyeshtha (Kettai)",
  mula: "Mula (Moolam)",
  purva_ashadha: "Purva Ashadha (Pooradam)",
  uttara_ashadha: "Uttara Ashadha (Uthiradam)",
  shravana: "Shravana (Thiruvonam)",
  dhanishta: "Dhanishta (Avittam)",
  shatabhisha: "Shatabhisha (Sadhayam)",
  purva_bhadrapada: "Purva Bhadrapada (Poorattathi)",
  uttara_bhadrapada: "Uttara Bhadrapada (Uthirattathi)",
  revati: "Revati",
};

export const VEDIC_GRAHAS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"] as const;
export type VedicGraha = (typeof VEDIC_GRAHAS)[number];

export const WESTERN_BODIES = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
] as const;
export type WesternBody = (typeof WESTERN_BODIES)[number];

export type PlanetKey = VedicGraha | WesternBody;

export const PLANET_NAMES_EN: Record<PlanetKey, string> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  rahu: "Rahu (North Node)",
  ketu: "Ketu (South Node)",
};

export function signIndexFromLongitude(longitude: number): number {
  return Math.floor(normalizeDegrees(longitude) / 30) % 12;
}

export function signFromLongitude(longitude: number): SignKey {
  return SIGN_KEYS[signIndexFromLongitude(longitude)]!;
}

export function normalizeDegrees(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

/** 123.456 -> "3°27′" within its sign. */
export function formatDegreeInSign(longitude: number): string {
  const inSign = normalizeDegrees(longitude) % 30;
  let degrees = Math.floor(inSign);
  let minutes = Math.round((inSign - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}
