import type { DashaPeriod, DashaTimeline } from "@/domain/astrology/chart-types";
import { normalizeDegrees, type VedicGraha } from "@/domain/astrology/constants";
import { isoDate } from "./facts";

/**
 * Vimshottari dasha: a 120-year cycle of planetary periods. The period running at
 * birth is ruled by the lord of the Moon's nakshatra; the unexpired part is
 * proportional to the distance the Moon still has to travel through that nakshatra.
 * Years are Julian years of 365.25 days (a common convention; some traditions use
 * 360-day years, which shifts dates - stated in the report's conventions).
 */
export const DASHA_ORDER: readonly VedicGraha[] = ["ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury"];

export const DASHA_YEARS: Record<VedicGraha, number> = {
  ketu: 7,
  venus: 20,
  sun: 6,
  moon: 10,
  mars: 7,
  rahu: 18,
  jupiter: 16,
  saturn: 19,
  mercury: 17,
};

export const DASHA_YEAR_DAYS = 365.25;
const YEAR_MS = DASHA_YEAR_DAYS * 86_400_000;
const NAKSHATRA_SPAN = 360 / 27;

export function nakshatraIndex(siderealLongitude: number): number {
  return Math.floor(normalizeDegrees(siderealLongitude) / NAKSHATRA_SPAN) % 27;
}

export function padaOf(siderealLongitude: number): number {
  const within = normalizeDegrees(siderealLongitude) % NAKSHATRA_SPAN;
  return Math.min(4, Math.floor(within / (NAKSHATRA_SPAN / 4)) + 1);
}

export function nakshatraLord(index: number): VedicGraha {
  return DASHA_ORDER[index % 9]!;
}

function subPeriods(lord: VedicGraha, startMs: number, clipFromMs: number): DashaPeriod[] {
  const periods: DashaPeriod[] = [];
  const startIndex = DASHA_ORDER.indexOf(lord);
  let cursor = startMs;
  for (let i = 0; i < 9; i += 1) {
    const sub = DASHA_ORDER[(startIndex + i) % 9]!;
    const lengthMs = ((DASHA_YEARS[lord] * DASHA_YEARS[sub]) / 120) * YEAR_MS;
    const end = cursor + lengthMs;
    if (end > clipFromMs) {
      periods.push({ lord: sub, start: isoDate(Math.max(cursor, clipFromMs)), end: isoDate(end) });
    }
    cursor = end;
  }
  return periods;
}

export function vimshottariTimeline(moonSiderealLongitude: number, birthUtcMs: number, horizonYears = 100): DashaTimeline {
  const index = nakshatraIndex(moonSiderealLongitude);
  const lord = nakshatraLord(index);
  const elapsedFraction = (normalizeDegrees(moonSiderealLongitude) % NAKSHATRA_SPAN) / NAKSHATRA_SPAN;
  const balanceYears = (1 - elapsedFraction) * DASHA_YEARS[lord];

  // The first period began (in theory) before birth; we only show its remaining part.
  const theoreticalStart = birthUtcMs - elapsedFraction * DASHA_YEARS[lord] * YEAR_MS;
  const horizon = birthUtcMs + horizonYears * YEAR_MS;
  const mahadashas: DashaPeriod[] = [];
  let cursor = theoreticalStart;
  let orderIndex = DASHA_ORDER.indexOf(lord);
  while (cursor < horizon) {
    const current = DASHA_ORDER[orderIndex % 9]!;
    const end = cursor + DASHA_YEARS[current] * YEAR_MS;
    mahadashas.push({
      lord: current,
      start: isoDate(Math.max(cursor, birthUtcMs)),
      end: isoDate(end),
      subPeriods: subPeriods(current, cursor, birthUtcMs),
    });
    cursor = end;
    orderIndex += 1;
  }
  return {
    lordAtBirth: lord,
    balanceAtBirthYears: Math.round(balanceYears * 1000) / 1000,
    mahadashas,
    uncertaintyDays: 0,
  };
}

/** Largest shift in period boundaries between two timelines with the same lords. */
export function maxBoundaryShiftDays(a: DashaTimeline, b: DashaTimeline): number {
  let max = 0;
  const count = Math.min(a.mahadashas.length, b.mahadashas.length);
  for (let i = 0; i < count; i += 1) {
    const diff = Math.abs(Date.parse(a.mahadashas[i]!.end) - Date.parse(b.mahadashas[i]!.end)) / 86_400_000;
    max = Math.max(max, diff);
  }
  return Math.round(max);
}
