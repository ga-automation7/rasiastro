import type * as Astronomy from "astronomy-engine";
import { normalizeDegrees } from "@/domain/astrology/constants";
import { earthOrientation } from "./ephemeris";

/**
 * Lahiri (Chitrapaksha) ayanamsa - the standard adopted by the Indian Calendar
 * Reform Committee and used by the Indian Astronomical Ephemeris.
 *
 * Definition: 23°15'00.658" (true, i.e. including nutation) on 21 March 1956 0h ET.
 * The mean value at that epoch is 23.245524743° (the true value minus the nutation in
 * longitude of that date, 16.769"), which is the same epoch constant the Swiss
 * Ephemeris uses for SE_SIDM_LAHIRI. We carry it forward with the IAU 2006 general
 * precession in longitude (Capitaine et al. 2003).
 *
 * Expected agreement with other software: within a few arcseconds for 1900-2100.
 */
const EPOCH_JD_TT = 2435553.5;
const EPOCH_MEAN_AYANAMSA = 23.245524743;
const J2000 = 2451545.0;

/** IAU 2006 accumulated general precession in longitude, arcseconds. */
function generalPrecessionArcsec(julianCenturiesTT: number): number {
  const t = julianCenturiesTT;
  return 5028.796195 * t + 1.1054348 * t ** 2 + 0.00007964 * t ** 3 - 0.000023857 * t ** 4 - 0.0000000383 * t ** 5;
}

export function lahiriMeanAyanamsa(time: Astronomy.AstroTime): number {
  const t = time.tt / 36525; // astronomy-engine measures tt in days since J2000
  const t0 = (EPOCH_JD_TT - J2000) / 36525;
  return EPOCH_MEAN_AYANAMSA + (generalPrecessionArcsec(t) - generalPrecessionArcsec(t0)) / 3600;
}

/**
 * Converts an apparent tropical longitude (true equinox of date) to sidereal.
 * The true ayanamsa (mean + nutation) is subtracted so nutation cancels out, which
 * matches how Indian ephemerides and the Swiss Ephemeris produce sidereal positions.
 */
export function toSidereal(tropicalLongitude: number, time: Astronomy.AstroTime): number {
  const trueAyanamsa = lahiriMeanAyanamsa(time) + earthOrientation(time).nutationLongitude;
  return normalizeDegrees(tropicalLongitude - trueAyanamsa);
}

/** The mean node is referred to the mean equinox, so only the mean ayanamsa applies. */
export function meanEquinoxToSidereal(meanLongitude: number, time: Astronomy.AstroTime): number {
  return normalizeDegrees(meanLongitude - lahiriMeanAyanamsa(time));
}
