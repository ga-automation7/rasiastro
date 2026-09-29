import type { AnglePoint, Aspect, ChartInput, Conventions, Fact, Placement, WesternChart } from "@/domain/astrology/chart-types";
import { WESTERN_BODIES, normalizeDegrees, signFromLongitude, type SignKey, type WesternBody } from "@/domain/astrology/constants";
import { tzDatabaseVersion } from "@/domain/birth-time";
import { westernDignity } from "./dignities";
import { EPHEMERIS_NAME, astroTime, dailyMotion, earthOrientation, signedDelta, tropicalLongitude } from "./ephemeris";
import { factFromSamples, longitudeRange, round4 } from "./facts";
import { computeAngles, houseOf, placidusCusps, porphyryCusps } from "./houses";
import { planSamples, statedIndex } from "./sampling";
import { aspectTransitPeriods } from "./transits";

interface Snapshot {
  t: number;
  bodies: Record<WesternBody, number>;
  ascendant: number | null;
  midheaven: number | null;
  cusps: number[] | null;
  houseSystem: "placidus" | "porphyry" | null;
}

function snapshot(t: number, input: ChartInput, withAngles: boolean): Snapshot {
  const time = astroTime(t);
  const bodies = Object.fromEntries(WESTERN_BODIES.map((b) => [b, tropicalLongitude(b, time)])) as Record<WesternBody, number>;
  if (!withAngles) return { t, bodies, ascendant: null, midheaven: null, cusps: null, houseSystem: null };
  const orientation = earthOrientation(time);
  const angles = computeAngles(orientation.gastDegrees, input.longitude, input.latitude, orientation.trueObliquity);
  const placidus = placidusCusps(angles, input.latitude, orientation.trueObliquity);
  return {
    t,
    bodies,
    ascendant: angles.ascendant,
    midheaven: angles.midheaven,
    cusps: placidus ?? porphyryCusps(angles),
    houseSystem: placidus ? "placidus" : "porphyry",
  };
}

/** Conventional orbs (degrees). Stated in the report's conventions. */
export const ASPECT_ORBS = { conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5 } as const;
const ASPECT_ANGLES: Record<Aspect["type"], number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };

type Point = Aspect["a"];

function aspectsAt(points: { key: Point; longitude: number }[]): Aspect[] {
  const found: Aspect[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i]!;
      const b = points[j]!;
      if ((a.key === "ascendant" || a.key === "midheaven") && (b.key === "ascendant" || b.key === "midheaven")) continue;
      const separation = Math.abs(signedDelta(a.longitude, b.longitude));
      for (const type of Object.keys(ASPECT_ANGLES) as Aspect["type"][]) {
        const orb = Math.abs(separation - ASPECT_ANGLES[type]);
        if (orb <= ASPECT_ORBS[type]) found.push({ a: a.key, b: b.key, type, orb: Math.round(orb * 100) / 100 });
      }
    }
  }
  return found;
}

const ELEMENT: Record<SignKey, "fire" | "earth" | "air" | "water"> = {
  aries: "fire", leo: "fire", sagittarius: "fire",
  taurus: "earth", virgo: "earth", capricorn: "earth",
  gemini: "air", libra: "air", aquarius: "air",
  cancer: "water", scorpio: "water", pisces: "water",
};
const MODALITY: Record<SignKey, "cardinal" | "fixed" | "mutable"> = {
  aries: "cardinal", cancer: "cardinal", libra: "cardinal", capricorn: "cardinal",
  taurus: "fixed", leo: "fixed", scorpio: "fixed", aquarius: "fixed",
  gemini: "mutable", virgo: "mutable", sagittarius: "mutable", pisces: "mutable",
};

export function buildWesternChart(input: ChartInput): WesternChart {
  const plan = planSamples(input);
  const snaps = plan.samples.map((t) => snapshot(t, input, plan.timeKnown));
  const statedSnap = plan.stated === null ? null : snaps[statedIndex(plan)]!;
  const middle = snaps[statedIndex(plan)]!;
  const stated = <T>(fn: (s: Snapshot) => T): T | null => (statedSnap ? fn(statedSnap) : null);
  const angleFact = (pick: (s: Snapshot) => number | null): Fact<AnglePoint> => {
    if (!plan.timeKnown) return { status: "omitted", reason: "birth_time_unknown" };
    const toPoint = (s: Snapshot): AnglePoint => ({ longitude: round4(pick(s)!), sign: signFromLongitude(pick(s)!) });
    return factFromSamples(snaps.map(toPoint), stated(toPoint), (a, b) => a.sign === b.sign);
  };

  const bodies: Placement[] = WESTERN_BODIES.map((body) => {
    const longitudes = snaps.map((s) => s.bodies[body]);
    const house: Fact<number> = plan.timeKnown
      ? factFromSamples(
          snaps.map((s) => houseOf(s.bodies[body], s.cusps!)),
          stated((s) => houseOf(s.bodies[body], s.cusps!)),
        )
      : { status: "omitted", reason: "birth_time_unknown" };
    const placement: Placement = {
      key: body,
      longitude: statedSnap ? round4(statedSnap.bodies[body]) : null,
      longitudeRange: longitudeRange(longitudes),
      sign: factFromSamples(longitudes.map(signFromLongitude), stated((s) => signFromLongitude(s.bodies[body]))),
      house,
      retrograde: body === "sun" || body === "moon" ? false : dailyMotion(body, astroTime(middle.t)) < 0,
    };
    const dignities = longitudes.map((l) => westernDignity(body, signFromLongitude(l)));
    if (dignities.every((d) => d !== null)) {
      placement.dignity = factFromSamples(
        dignities as NonNullable<(typeof dignities)[number]>[],
        stated((s) => westernDignity(body, signFromLongitude(s.bodies[body]))),
      );
    }
    return placement;
  });

  // Aspects: "stable" when present with the same type across the whole window.
  const pointsOf = (s: Snapshot) => [
    ...WESTERN_BODIES.map((b) => ({ key: b as Point, longitude: s.bodies[b] })),
    ...(s.ascendant !== null ? [{ key: "ascendant" as Point, longitude: s.ascendant }] : []),
    ...(s.midheaven !== null ? [{ key: "midheaven" as Point, longitude: s.midheaven }] : []),
  ];
  const perSample = snaps.map((s) => aspectsAt(pointsOf(s)));
  const keyOf = (x: Aspect) => `${x.a}|${x.b}|${x.type}`;
  const reference = statedSnap ? aspectsAt(pointsOf(statedSnap)) : perSample.flat();
  const stable: Aspect[] = [];
  const uncertain: Aspect[] = [];
  const seen = new Set<string>();
  for (const aspect of reference) {
    const key = keyOf(aspect);
    if (seen.has(key)) continue;
    seen.add(key);
    const everywhere = perSample.every((list) => list.some((x) => keyOf(x) === key));
    const orbs = perSample.flatMap((list) => list.filter((x) => keyOf(x) === key).map((x) => x.orb));
    // With no stated time we report the widest orb seen, never an orb "at noon".
    const orb = statedSnap ? aspect.orb : Math.max(...orbs);
    (everywhere ? stable : uncertain).push({ ...aspect, orb });
  }

  const sect: Fact<"day" | "night"> = plan.timeKnown
    ? factFromSamples(
        snaps.map((s) => sectOf(s)),
        stated(sectOf),
      )
    : { status: "omitted", reason: "birth_time_unknown" };

  const elementBalance = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalityBalance = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const placement of bodies) {
    if (placement.sign.status !== "known") continue;
    elementBalance[ELEMENT[placement.sign.value]] += 1;
    modalityBalance[MODALITY[placement.sign.value]] += 1;
  }

  const houseSystem = statedSnap?.houseSystem ?? middle.houseSystem;
  const referenceMs = input.referenceDate.getTime();
  const yearMs = 365.25 * 86_400_000;
  const natalFor = (key: WesternBody) => bodies.find((b) => b.key === key)!;
  const natalPoints: { key: string; longitude: number }[] = [];
  if (statedSnap) {
    natalPoints.push({ key: "sun", longitude: statedSnap.bodies.sun });
    if (natalFor("moon").sign.status === "known") natalPoints.push({ key: "moon", longitude: statedSnap.bodies.moon });
    if (statedSnap.ascendant !== null && plan.window.certainty === "exact") {
      natalPoints.push({ key: "ascendant", longitude: statedSnap.ascendant });
    }
  } else {
    // Unknown time: the Sun moves ~1 degree per day, so its day-average is safe for slow transits.
    const sunRange = natalFor("sun").longitudeRange;
    natalPoints.push({ key: "sun", longitude: normalizeDegrees((sunRange[0] + sunRange[1]) / 2) });
  }
  const birthMs = plan.stated ?? input.dayStartUtcMs;
  const saturnNatal = statedSnap?.bodies.saturn ?? snaps[0]!.bodies.saturn;
  const transits = [
    ...aspectTransitPeriods("saturn", [{ key: "saturn", longitude: saturnNatal }], ["conjunction"], birthMs + 25 * yearMs, referenceMs + 8 * yearMs),
    ...aspectTransitPeriods("saturn", natalPoints, ["conjunction", "square", "opposition"], referenceMs - yearMs, referenceMs + 2 * yearMs),
    ...aspectTransitPeriods("jupiter", natalPoints, ["conjunction", "trine", "opposition"], referenceMs - yearMs, referenceMs + 2 * yearMs),
  ].sort((a, b) => a.start.localeCompare(b.start));

  const conventions: Conventions = {
    zodiac: "tropical",
    ayanamsa: null,
    houseSystem: plan.timeKnown ? houseSystem : null,
    nodes: null,
    dasha: null,
    dashaYearDays: null,
    ephemeris: EPHEMERIS_NAME,
    timeZoneDatabase: `IANA tz ${tzDatabaseVersion() ?? "(runtime)"}`,
    notes: [
      "tropical_zodiac",
      houseSystem === "porphyry" ? "porphyry_fallback_high_latitude" : "placidus_houses",
      "major_aspects_conventional_orbs",
      "traditional_dignities_seven_planets",
    ],
  };

  return {
    kind: "western",
    window: plan.window,
    conventions,
    bodies,
    ascendant: angleFact((s) => s.ascendant),
    midheaven: angleFact((s) => s.midheaven),
    houseCusps: statedSnap?.cusps ? statedSnap.cusps.map(round4) : null,
    aspects: stable,
    uncertainAspects: uncertain,
    sect,
    elementBalance,
    modalityBalance,
    transits,
  };
}

/** Day chart when the Sun is above the horizon (the half of the ecliptic from DSC to ASC). */
function sectOf(s: Snapshot): "day" | "night" {
  const descendant = normalizeDegrees(s.ascendant! + 180);
  return normalizeDegrees(s.bodies.sun - descendant) < 180 ? "day" : "night";
}
