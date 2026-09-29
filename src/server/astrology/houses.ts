import { normalizeDegrees } from "@/domain/astrology/constants";

/**
 * Ascendant, Midheaven and house cusps from sidereal time, latitude and obliquity.
 * All inputs/outputs in degrees; longitudes are tropical (true ecliptic of date).
 */
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface Angles {
  /** Right ascension of the Midheaven (local apparent sidereal time) in degrees. */
  ramc: number;
  ascendant: number;
  midheaven: number;
}

export function computeAngles(gastDegrees: number, eastLongitude: number, latitude: number, obliquity: number): Angles {
  const ramc = normalizeDegrees(gastDegrees + eastLongitude);
  const e = rad(obliquity);
  const r = rad(ramc);
  const phi = rad(latitude);
  const midheaven = normalizeDegrees(deg(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e))));
  const ascendant = normalizeDegrees(
    deg(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e)))),
  );
  return { ramc, ascendant, midheaven };
}

/** Ecliptic longitude whose right ascension is `ra` (both degrees). */
function longitudeFromRightAscension(ra: number, obliquity: number): number {
  const r = rad(ra);
  return normalizeDegrees(deg(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(rad(obliquity)))));
}

function declinationOf(longitude: number, obliquity: number): number {
  return deg(Math.asin(Math.sin(rad(longitude)) * Math.sin(rad(obliquity))));
}

/** Diurnal semi-arc in degrees, or null if the point never rises/sets (polar). */
function diurnalSemiArc(declination: number, latitude: number): number | null {
  const x = -Math.tan(rad(latitude)) * Math.tan(rad(declination));
  if (x < -1 || x > 1) return null;
  return deg(Math.acos(x));
}

/**
 * Placidus cusps by the classical semi-arc iteration. Cusp 11 lies one third and cusp
 * 12 two thirds of each point's diurnal semi-arc east of the meridian; cusps 2 and 3
 * trisect the nocturnal semi-arc below the horizon. Opposite cusps are +180°.
 *
 * Returns null when the iteration cannot converge - above roughly 66° latitude,
 * where parts of the ecliptic never rise or set and Placidus is undefined.
 */
export function placidusCusps(angles: Angles, latitude: number, obliquity: number): number[] | null {
  const { ramc, ascendant, midheaven } = angles;
  const solve = (offset: (dsa: number) => number): number | null => {
    let longitude = longitudeFromRightAscension(ramc + offset(90), obliquity);
    for (let i = 0; i < 100; i += 1) {
      const dsa = diurnalSemiArc(declinationOf(longitude, obliquity), latitude);
      if (dsa === null) return null;
      const next = longitudeFromRightAscension(ramc + offset(dsa), obliquity);
      const delta = Math.abs(normalizeDegrees(next - longitude + 180) - 180);
      longitude = next;
      if (delta < 1e-9) return longitude;
    }
    return null;
  };

  const c11 = solve((dsa) => dsa / 3);
  const c12 = solve((dsa) => (2 * dsa) / 3);
  const c2 = solve((dsa) => 60 + (2 * dsa) / 3);
  const c3 = solve((dsa) => 120 + dsa / 3);
  if (c11 === null || c12 === null || c2 === null || c3 === null) return null;

  const cusps = [
    ascendant,
    c2,
    c3,
    normalizeDegrees(midheaven + 180),
    normalizeDegrees(c11 + 180),
    normalizeDegrees(c12 + 180),
    normalizeDegrees(ascendant + 180),
    normalizeDegrees(c2 + 180),
    normalizeDegrees(c3 + 180),
    midheaven,
    c11,
    c12,
  ];
  return isMonotonicZodiacalOrder(cusps) ? cusps : null;
}

/** Porphyry: trisects each quadrant along the ecliptic. Defined at every latitude. */
export function porphyryCusps(angles: Angles): number[] {
  const { ascendant, midheaven } = angles;
  const ic = normalizeDegrees(midheaven + 180);
  const q1 = normalizeDegrees(ic - ascendant); // houses 1-3
  const q2 = normalizeDegrees(normalizeDegrees(ascendant + 180) - ic); // houses 4-6
  const cusps = [
    ascendant,
    ascendant + q1 / 3,
    ascendant + (2 * q1) / 3,
    ic,
    ic + q2 / 3,
    ic + (2 * q2) / 3,
  ].map(normalizeDegrees);
  return [...cusps, ...cusps.map((c) => normalizeDegrees(c + 180))];
}

function isMonotonicZodiacalOrder(cusps: number[]): boolean {
  let total = 0;
  for (let i = 0; i < 12; i += 1) {
    const span = normalizeDegrees(cusps[(i + 1) % 12]! - cusps[i]!);
    if (span <= 0 || span >= 180) return false;
    total += span;
  }
  return Math.abs(total - 360) < 1e-6;
}

/** House (1-12) containing a longitude, given 12 cusp longitudes. */
export function houseOf(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i += 1) {
    const start = cusps[i]!;
    const end = cusps[(i + 1) % 12]!;
    const span = normalizeDegrees(end - start);
    if (normalizeDegrees(longitude - start) < span) return i + 1;
  }
  return 12;
}

/** Whole-sign house of a longitude counted from the ascendant's sign. */
export function wholeSignHouse(longitude: number, ascendantLongitude: number): number {
  const signOf = (l: number) => Math.floor(normalizeDegrees(l) / 30);
  return ((signOf(longitude) - signOf(ascendantLongitude) + 12) % 12) + 1;
}
