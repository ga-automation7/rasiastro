import type { Dignity } from "@/domain/astrology/chart-types";
import type { PlanetKey, SignKey } from "@/domain/astrology/constants";

type Table = Partial<Record<PlanetKey, { exalted: SignKey; debilitated: SignKey; own: SignKey[]; detriment?: SignKey[] }>>;

/** Classical exaltation/debilitation and own signs shared by Indian and Hellenistic astrology. */
const CLASSICAL: Table = {
  sun: { exalted: "aries", debilitated: "libra", own: ["leo"], detriment: ["aquarius"] },
  moon: { exalted: "taurus", debilitated: "scorpio", own: ["cancer"], detriment: ["capricorn"] },
  mercury: { exalted: "virgo", debilitated: "pisces", own: ["gemini", "virgo"], detriment: ["sagittarius", "pisces"] },
  venus: { exalted: "pisces", debilitated: "virgo", own: ["taurus", "libra"], detriment: ["scorpio", "aries"] },
  mars: { exalted: "capricorn", debilitated: "cancer", own: ["aries", "scorpio"], detriment: ["libra", "taurus"] },
  jupiter: { exalted: "cancer", debilitated: "capricorn", own: ["sagittarius", "pisces"], detriment: ["gemini", "virgo"] },
  saturn: { exalted: "libra", debilitated: "aries", own: ["capricorn", "aquarius"], detriment: ["cancer", "leo"] },
};

/** Vedic dignity (Rahu/Ketu have no agreed dignities, so none is given). */
export function vedicDignity(planet: PlanetKey, sign: SignKey): Dignity | null {
  const entry = CLASSICAL[planet];
  if (!entry) return null;
  if (entry.exalted === sign) return "exalted";
  if (entry.debilitated === sign) return "debilitated";
  if (entry.own.includes(sign)) return "own_sign";
  return "neutral";
}

/** Traditional Western essential dignity for the seven classical planets. */
export function westernDignity(planet: PlanetKey, sign: SignKey): Dignity | null {
  const entry = CLASSICAL[planet];
  if (!entry) return null;
  if (entry.own.includes(sign)) return "domicile";
  if (entry.exalted === sign) return "exalted";
  if (entry.detriment?.includes(sign)) return "detriment";
  if (entry.debilitated === sign) return "fall";
  return "neutral";
}
