import type { TransitPeriod } from "@/domain/astrology/chart-types";
import { signIndexFromLongitude } from "@/domain/astrology/constants";
import { toSidereal } from "./ayanamsa";
import { astroTime, signedDelta, tropicalLongitude } from "./ephemeris";
import { isoDate } from "./facts";

/**
 * Slow-planet transits used for the "looking back" and "looking ahead" sections.
 * These are calculated facts (where Saturn/Jupiter are and when); the report
 * interprets them as possible themes, never as certain events.
 */
const DAY_MS = 86_400_000;

interface Interval {
  start: number;
  end: number;
}

function scan(startMs: number, endMs: number, stepDays: number, fn: (ms: number) => void): void {
  for (let t = startMs; t <= endMs; t += stepDays * DAY_MS) fn(t);
}

/** Groups consecutive samples with the same key into intervals. */
function groupByKey<K>(startMs: number, endMs: number, stepDays: number, keyAt: (ms: number) => K | null): { key: K; interval: Interval }[] {
  const groups: { key: K; interval: Interval }[] = [];
  scan(startMs, endMs, stepDays, (t) => {
    const key = keyAt(t);
    const last = groups[groups.length - 1];
    if (key === null) return;
    if (last && last.key === key && t - last.interval.end <= stepDays * DAY_MS + 1) {
      last.interval.end = t;
    } else {
      groups.push({ key, interval: { start: t, end: t } });
    }
  });
  return groups;
}

function mergeClose(intervals: Interval[], maxGapDays: number): Interval[] {
  const merged: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && interval.start - last.end <= maxGapDays * DAY_MS) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

function siderealSign(body: "saturn" | "jupiter", ms: number): number {
  const time = astroTime(ms);
  return signIndexFromLongitude(toSidereal(tropicalLongitude(body, time), time));
}

/** Whole 7.5-year Sade Sati spans: Saturn in the 12th, 1st or 2nd sign from the Moon. */
export function sadeSatiPeriods(moonSignIndex: number, fromMs: number, toMs: number): TransitPeriod[] {
  const inPhase = (ms: number) => {
    const house = (siderealSign("saturn", ms) - moonSignIndex + 12) % 12;
    return house === 11 || house === 0 || house === 1 ? true : null;
  };
  const raw = groupByKey(fromMs, toMs, 5, inPhase).map((g) => g.interval);
  return mergeClose(raw, 400).map((i) => ({
    body: "saturn",
    target: "moon_sign",
    aspect: "sign",
    start: isoDate(i.start),
    end: isoDate(i.end),
    detail: "sade_sati",
  }));
}

/** Periods by house counted from the natal Moon sign (Gochara). */
export function fromMoonSignPeriods(body: "saturn" | "jupiter", moonSignIndex: number, fromMs: number, toMs: number): TransitPeriod[] {
  return groupByKey(fromMs, toMs, 3, (ms) => ((siderealSign(body, ms) - moonSignIndex + 12) % 12) + 1).map((g) => ({
    body,
    target: "moon_sign",
    aspect: "sign",
    start: isoDate(g.interval.start),
    end: isoDate(g.interval.end),
    detail: `house_${g.key}_from_moon`,
  }));
}

const ASPECT_ANGLES = { conjunction: 0, square: 90, opposition: 180, trine: 120 } as const;

/**
 * Western transits: periods when transiting Saturn/Jupiter are within `orb` degrees
 * of an exact aspect to a natal point. Conjunctions of a planet to its own natal
 * position are labelled "return".
 */
export function aspectTransitPeriods(
  body: "saturn" | "jupiter",
  natalPoints: { key: string; longitude: number }[],
  aspects: (keyof typeof ASPECT_ANGLES)[],
  fromMs: number,
  toMs: number,
  orb = 1.5,
): TransitPeriod[] {
  const periods: TransitPeriod[] = [];
  const samples: { t: number; lon: number }[] = [];
  scan(fromMs, toMs, 2, (t) => samples.push({ t, lon: tropicalLongitude(body, astroTime(t)) }));
  for (const point of natalPoints) {
    for (const aspect of aspects) {
      const angle = ASPECT_ANGLES[aspect];
      const hits: Interval[] = [];
      for (const s of samples) {
        const separation = Math.abs(signedDelta(point.longitude, s.lon));
        if (Math.abs(separation - angle) <= orb) {
          const last = hits[hits.length - 1];
          if (last && s.t - last.end <= 2 * DAY_MS + 1) last.end = s.t;
          else hits.push({ start: s.t, end: s.t });
        }
      }
      for (const interval of mergeClose(hits, 300)) {
        const isReturn = aspect === "conjunction" && point.key === body;
        periods.push({
          body,
          target: point.key,
          aspect: isReturn ? "return" : aspect,
          start: isoDate(interval.start),
          end: isoDate(interval.end),
        });
      }
    }
  }
  return periods.sort((a, b) => a.start.localeCompare(b.start));
}
