import * as Astronomy from "astronomy-engine";
import { normalizeDegrees, type WesternBody } from "@/domain/astrology/constants";

/**
 * Planetary positions from astronomy-engine (MIT licence, by Don Cross), which
 * implements VSOP87 / NOVAS-derived models with a stated accuracy of about
 * +/- 1 arcminute - well inside what sign, nakshatra and pada boundaries need.
 *
 * All longitudes here are TROPICAL, geocentric and apparent (true equinox and
 * ecliptic of date, corrected for light-time and aberration).
 */
export const EPHEMERIS_NAME = "astronomy-engine 2.1.19 (MIT)";

const BODIES: Record<WesternBody, Astronomy.Body> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

export function astroTime(utcMs: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date(utcMs));
}

export function tropicalLongitude(body: WesternBody, time: Astronomy.AstroTime): number {
  if (body === "sun") return normalizeDegrees(Astronomy.SunPosition(time).elon);
  if (body === "moon") return normalizeDegrees(Astronomy.EclipticGeoMoon(time).lon);
  const vector = Astronomy.GeoVector(BODIES[body], time, true);
  return normalizeDegrees(Astronomy.Ecliptic(vector).elon);
}

/** Signed angular difference b - a in (-180, 180]. */
export function signedDelta(a: number, b: number): number {
  let d = normalizeDegrees(b - a);
  if (d > 180) d -= 360;
  return d;
}

/** Daily motion in degrees/day (negative = retrograde), by central difference. */
export function dailyMotion(body: WesternBody, time: Astronomy.AstroTime): number {
  const before = tropicalLongitude(body, time.AddDays(-0.5));
  const after = tropicalLongitude(body, time.AddDays(0.5));
  return signedDelta(before, after);
}

/**
 * Mean longitude of the Moon's ascending node (Rahu), referred to the mean equinox of
 * date. Meeus, Astronomical Algorithms (2nd ed.), eq. 47.7.
 */
export function meanNodeLongitude(time: Astronomy.AstroTime): number {
  const t = time.tt / 36525;
  const omega = 125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441 - (t * t * t * t) / 60616000;
  return normalizeDegrees(omega);
}

export interface EarthOrientation {
  /** Greenwich apparent sidereal time in degrees. */
  gastDegrees: number;
  /** True obliquity of the ecliptic in degrees. */
  trueObliquity: number;
  /** Nutation in longitude in degrees. */
  nutationLongitude: number;
}

export function earthOrientation(time: Astronomy.AstroTime): EarthOrientation {
  const tilt = Astronomy.e_tilt(time);
  return {
    gastDegrees: Astronomy.SiderealTime(time) * 15,
    trueObliquity: tilt.tobl,
    nutationLongitude: tilt.dpsi / 3600,
  };
}

/** Next sunrise at/after `fromUtcMs` for an observer, or null (polar day/night). */
export function nextSunrise(fromUtcMs: number, latitude: number, longitude: number): number | null {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const result = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, astroTime(fromUtcMs), 2);
  return result ? result.date.getTime() : null;
}

/** Most recent new moon at or before `utcMs`, and the next one after it. */
export function surroundingNewMoons(utcMs: number): { previous: number; next: number } {
  const start = astroTime(utcMs - 32 * 86_400_000);
  let previous: number | null = null;
  let cursor = start;
  for (let i = 0; i < 3; i += 1) {
    const found = Astronomy.SearchMoonPhase(0, cursor, 40);
    if (!found) break;
    const ms = found.date.getTime();
    if (ms <= utcMs) {
      previous = ms;
      cursor = found.AddDays(1);
      continue;
    }
    if (previous === null) throw new Error("Could not locate previous new moon");
    return { previous, next: ms };
  }
  throw new Error("Could not locate surrounding new moons");
}
