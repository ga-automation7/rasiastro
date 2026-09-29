import { CATEGORY_ANALYSIS, getCategory, type CompatibilityCategory } from "@/config/compatibility";
import type { ChartData, Fact, Placement, VedicChart, WesternChart } from "@/domain/astrology/chart-types";
import type {
  Friendship,
  Gana,
  HouseOverlay,
  IndianFactor,
  IndianPairAnalysis,
  InterAspect,
  MoonSignRelation,
  Nadi,
  PairAnalysis,
  PairPoint,
  PersonIndex,
  SignAxis,
  TaraName,
  TaraRelation,
  WesternPairAnalysis,
  WesternPersonSummary,
  YoniAnimal,
} from "@/domain/astrology/compatibility-types";
import { NAKSHATRA_KEYS, SIGN_KEYS, signFromLongitude, type NakshatraKey, type SignKey, type VedicGraha, type WesternBody } from "@/domain/astrology/constants";
import { signedDelta } from "./ephemeris";
import { houseOf } from "./houses";
import { ASPECT_ORBS } from "./western";

/**
 * Cross-chart (synastry) calculations for compatibility reports. Pure functions of the
 * two stored charts: deterministic, versioned, and never produced by AI.
 *
 * Uncertainty is carried through honestly: when a person's birth time leaves their
 * Moon sign or nakshatra open, every combination of candidates is evaluated; a factor
 * is "known" only if all combinations agree.
 */
export const PAIR_CALCULATION_VERSION = "rasi-pair-1.0.0";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function candidatesOf<T>(fact: Fact<T>): T[] | null {
  if (fact.status === "known") return [fact.value];
  if (fact.status === "uncertain") return fact.candidates;
  return null;
}

function statedOf<T>(fact: Fact<T>): T | null {
  if (fact.status === "known") return fact.value;
  if (fact.status === "uncertain") return fact.atStatedTime;
  return null;
}

/** Evaluates `fn` over every combination of both people's possible values. */
export function combineFacts<A, B, R>(fa: Fact<A>, fb: Fact<B>, fn: (a: A, b: B) => R): Fact<R> {
  const ca = candidatesOf(fa);
  const cb = candidatesOf(fb);
  if (!ca || !cb) return { status: "omitted", reason: "birth_time_unknown" };
  const results = new Map<string, R>();
  for (const a of ca) for (const b of cb) {
    const r = fn(a, b);
    results.set(JSON.stringify(r), r);
  }
  const unique = [...results.values()];
  if (unique.length === 1) return { status: "known", value: unique[0]! };
  const sa = statedOf(fa);
  const sb = statedOf(fb);
  return { status: "uncertain", candidates: unique, atStatedTime: sa !== null && sb !== null ? fn(sa, sb) : null };
}

function mapFact<T, U>(fact: Fact<T>, fn: (v: T) => U): Fact<U> {
  if (fact.status === "known") return { status: "known", value: fn(fact.value) };
  if (fact.status === "omitted") return fact;
  const mapped = new Map<string, U>();
  for (const c of fact.candidates) {
    const u = fn(c);
    mapped.set(JSON.stringify(u), u);
  }
  const candidates = [...mapped.values()];
  if (candidates.length === 1) return { status: "known", value: candidates[0]! };
  return { status: "uncertain", candidates, atStatedTime: fact.atStatedTime === null ? null : fn(fact.atStatedTime) };
}

// ---------------------------------------------------------------------------
// Indian (Vedic) factor tables - standard traditional tables
// ---------------------------------------------------------------------------

const SIGN_LORD: Record<SignKey, VedicGraha> = {
  aries: "mars",
  taurus: "venus",
  gemini: "mercury",
  cancer: "moon",
  leo: "sun",
  virgo: "mercury",
  libra: "venus",
  scorpio: "mars",
  sagittarius: "jupiter",
  capricorn: "saturn",
  aquarius: "saturn",
  pisces: "jupiter",
};

/** Natural (naisargika) friendships of the seven planets, as given by Parashara. */
const NATURAL_FRIENDSHIP: Record<string, { friends: VedicGraha[]; enemies: VedicGraha[] }> = {
  sun: { friends: ["moon", "mars", "jupiter"], enemies: ["venus", "saturn"] },
  moon: { friends: ["sun", "mercury"], enemies: [] },
  mars: { friends: ["sun", "moon", "jupiter"], enemies: ["mercury"] },
  mercury: { friends: ["sun", "venus"], enemies: ["moon"] },
  jupiter: { friends: ["sun", "moon", "mars"], enemies: ["mercury", "venus"] },
  venus: { friends: ["mercury", "saturn"], enemies: ["sun", "moon"] },
  saturn: { friends: ["mercury", "venus"], enemies: ["sun", "moon", "mars"] },
};

export function friendship(of: VedicGraha, toward: VedicGraha): Friendship {
  if (of === toward) return "same";
  const entry = NATURAL_FRIENDSHIP[of];
  if (!entry) return "neutral";
  if (entry.friends.includes(toward)) return "friend";
  if (entry.enemies.includes(toward)) return "enemy";
  return "neutral";
}

const DEVA = new Set<NakshatraKey>(["ashwini", "mrigashira", "punarvasu", "pushya", "hasta", "swati", "anuradha", "shravana", "revati"]);
const RAKSHASA = new Set<NakshatraKey>(["krittika", "ashlesha", "magha", "chitra", "vishakha", "jyeshtha", "mula", "dhanishta", "shatabhisha"]);

export function ganaOf(n: NakshatraKey): Gana {
  return DEVA.has(n) ? "deva" : RAKSHASA.has(n) ? "rakshasa" : "manushya";
}

/** Nadi follows a zig-zag through the 27 nakshatras: Adi, Madhya, Antya, Antya, Madhya, Adi, ... */
const NADI_CYCLE: Nadi[] = ["adi", "madhya", "antya", "antya", "madhya", "adi"];
export function nadiOf(n: NakshatraKey): Nadi {
  return NADI_CYCLE[NAKSHATRA_KEYS.indexOf(n) % 6]!;
}

const YONI: Record<NakshatraKey, YoniAnimal> = {
  ashwini: "horse",
  bharani: "elephant",
  krittika: "sheep",
  rohini: "serpent",
  mrigashira: "serpent",
  ardra: "dog",
  punarvasu: "cat",
  pushya: "sheep",
  ashlesha: "cat",
  magha: "rat",
  purva_phalguni: "rat",
  uttara_phalguni: "cow",
  hasta: "buffalo",
  chitra: "tiger",
  swati: "buffalo",
  vishakha: "tiger",
  anuradha: "deer",
  jyeshtha: "deer",
  mula: "dog",
  purva_ashadha: "monkey",
  uttara_ashadha: "mongoose",
  shravana: "monkey",
  dhanishta: "lion",
  shatabhisha: "horse",
  purva_bhadrapada: "lion",
  uttara_bhadrapada: "cow",
  revati: "elephant",
};
export function yoniOf(n: NakshatraKey): YoniAnimal {
  return YONI[n];
}

/** The seven pairs traditionally described as natural enemies. */
const OPPOSED_YONI: [YoniAnimal, YoniAnimal][] = [
  ["horse", "buffalo"],
  ["elephant", "lion"],
  ["sheep", "monkey"],
  ["serpent", "mongoose"],
  ["dog", "deer"],
  ["cat", "rat"],
  ["cow", "tiger"],
];

const TARAS: TaraName[] = ["janma", "sampat", "vipat", "kshema", "pratyak", "sadhana", "naidhana", "mitra", "parama_mitra"];
const CHALLENGING_TARAS = new Set<TaraName>(["vipat", "pratyak", "naidhana"]);

function tara(from: NakshatraKey, to: NakshatraKey) {
  const count = ((NAKSHATRA_KEYS.indexOf(to) - NAKSHATRA_KEYS.indexOf(from) + 27) % 27) + 1;
  const name = TARAS[(count - 1) % 9]!;
  return { count, tara: name, traditionallyChallenging: CHALLENGING_TARAS.has(name) };
}

export function taraRelation(a: NakshatraKey, b: NakshatraKey): TaraRelation {
  return { aToB: tara(a, b), bToA: tara(b, a) };
}

export function moonSignRelation(a: SignKey, b: SignKey): MoonSignRelation {
  const ia = SIGN_KEYS.indexOf(a);
  const ib = SIGN_KEYS.indexOf(b);
  const aToB = ((ib - ia + 12) % 12) + 1;
  const bToA = ((ia - ib + 12) % 12) + 1;
  const low = Math.min(aToB, bToA);
  const axis = (low === 1 ? "1/1" : low === 7 ? "7/7" : `${low}/${14 - low}`) as SignAxis;
  return { aToB, bToA, axis, bhakootTraditionallyChallenging: axis === "2/12" || axis === "5/9" || axis === "6/8" };
}

function indianFactor(key: IndianFactor["key"], a: VedicChart, b: VedicChart): IndianFactor {
  switch (key) {
    case "moon_sign_relationship":
      return { key, result: combineFacts(a.moonSign, b.moonSign, moonSignRelation) };
    case "tara":
      return { key, result: combineFacts(a.moonNakshatra, b.moonNakshatra, taraRelation) };
    case "gana":
      return { key, result: combineFacts(a.moonNakshatra, b.moonNakshatra, (x, y) => ({ a: ganaOf(x), b: ganaOf(y), same: ganaOf(x) === ganaOf(y) })) };
    case "graha_maitri":
      return {
        key,
        result: combineFacts(a.moonSign, b.moonSign, (x, y) => {
          const aLord = SIGN_LORD[x];
          const bLord = SIGN_LORD[y];
          return { aLord, bLord, aTowardB: friendship(aLord, bLord), bTowardA: friendship(bLord, aLord) };
        }),
      };
    case "yoni":
      return {
        key,
        result: combineFacts(a.moonNakshatra, b.moonNakshatra, (x, y) => {
          const ya = yoniOf(x);
          const yb = yoniOf(y);
          const opposed = OPPOSED_YONI.some(([p, q]) => (p === ya && q === yb) || (p === yb && q === ya));
          return { a: ya, b: yb, relation: ya === yb ? ("same" as const) : opposed ? ("traditionally_opposed" as const) : ("different" as const) };
        }),
      };
    case "nadi":
      return { key, result: combineFacts(a.moonNakshatra, b.moonNakshatra, (x, y) => ({ a: nadiOf(x), b: nadiOf(y), same: nadiOf(x) === nadiOf(y) })) };
  }
}

export function analyseIndianPair(category: CompatibilityCategory, a: VedicChart, b: VedicChart): IndianPairAnalysis {
  const factorKeys = CATEGORY_ANALYSIS[category].indianFactors;
  // Defence in depth: the marriage-matching factors never appear outside romantic categories.
  const allowed = getCategory(category).romantic ? factorKeys : factorKeys.filter((k) => k !== "yoni" && k !== "nadi");
  const person = (c: VedicChart) => ({
    timeCertainty: c.window.certainty,
    moonSign: c.moonSign,
    nakshatra: c.moonNakshatra,
    lagnaSign: mapFact(c.lagna, (l) => l.sign),
  });
  return { kind: "indian", category, people: [person(a), person(b)], factors: allowed.map((k) => indianFactor(k, a, b)) };
}

// ---------------------------------------------------------------------------
// Western (synastry)
// ---------------------------------------------------------------------------

const SYNASTRY_BODIES: WesternBody[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];
const ASPECT_ANGLES = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 } as const;
type AspectType = keyof typeof ASPECT_ANGLES;

interface PointRange {
  key: PairPoint;
  stated: number | null;
  range: [number, number];
}

function pointsOf(chart: WesternChart): PointRange[] {
  const points: PointRange[] = SYNASTRY_BODIES.map((key) => {
    const p = chart.bodies.find((x) => x.key === key) as Placement;
    return { key, stated: p.longitude, range: p.longitudeRange };
  });
  // The Ascendant moves about a degree every four minutes: only used with an exact time.
  if (chart.window.certainty === "exact" && chart.ascendant.status === "known") {
    const l = chart.ascendant.value.longitude;
    points.push({ key: "ascendant", stated: l, range: [l, l] });
  }
  return points;
}

const SAMPLES = 7;
function samples(range: [number, number]): number[] {
  const [lo, hi] = range;
  if (hi - lo < 1e-9) return [lo];
  return Array.from({ length: SAMPLES }, (_, i) => lo + ((hi - lo) * i) / (SAMPLES - 1));
}

/** Orb of an aspect type between two longitudes (degrees), or null when outside the orb. */
function orbFor(type: AspectType, x: number, y: number): number | null {
  const separation = Math.abs(signedDelta(x, y));
  const orb = Math.abs(separation - ASPECT_ANGLES[type]);
  return orb <= ASPECT_ORBS[type] ? orb : null;
}

export function interAspects(a: WesternChart, b: WesternChart, focus: readonly WesternBody[]): InterAspect[] {
  const found: InterAspect[] = [];
  for (const pa of pointsOf(a)) {
    for (const pb of pointsOf(b)) {
      for (const type of Object.keys(ASPECT_ANGLES) as AspectType[]) {
        let inside = 0;
        let total = 0;
        for (const x of samples(pa.range)) for (const y of samples(pb.range)) {
          total += 1;
          if (orbFor(type, x, y) !== null) inside += 1;
        }
        if (inside === 0) continue;
        const statedOrb = pa.stated !== null && pb.stated !== null ? orbFor(type, pa.stated, pb.stated) : null;
        found.push({
          a: pa.key,
          b: pb.key,
          type,
          orb: statedOrb === null ? null : Math.round(statedOrb * 10) / 10,
          certainty: inside === total ? "known" : "uncertain",
          focus: focus.includes(pa.key as WesternBody) || focus.includes(pb.key as WesternBody),
        });
      }
    }
  }
  const rank = (x: InterAspect) => (x.focus ? 0 : 2) + (x.certainty === "known" ? 0 : 1);
  return found.sort((x, y) => rank(x) - rank(y) || (x.orb ?? 99) - (y.orb ?? 99)).slice(0, 16);
}

function overlay(from: WesternChart, into: WesternChart, fromIndex: PersonIndex, intoIndex: PersonIndex): HouseOverlay | null {
  // House positions need the RECEIVING chart's exact birth time.
  if (into.window.certainty !== "exact" || !into.houseCusps) return null;
  const cusps = into.houseCusps;
  const placements = SYNASTRY_BODIES.map((body) => {
    const p = from.bodies.find((x) => x.key === body) as Placement;
    const houses = [...new Set(samples(p.longitudeRange).map((l) => houseOf(((l % 360) + 360) % 360, cusps)))];
    const stated = p.longitude === null ? null : houseOf(p.longitude, cusps);
    const house: Fact<number> = houses.length === 1 ? { status: "known", value: houses[0]! } : { status: "uncertain", candidates: houses, atStatedTime: stated };
    return { body, house };
  });
  return { from: fromIndex, into: intoIndex, placements };
}

function westernPerson(c: WesternChart): WesternPersonSummary {
  const body = (k: WesternBody) => (c.bodies.find((b) => b.key === k) as Placement).sign;
  return {
    timeCertainty: c.window.certainty,
    sun: body("sun"),
    moon: body("moon"),
    ascendant: mapFact(c.ascendant, (x) => x.sign),
    elementBalance: c.elementBalance,
    modalityBalance: c.modalityBalance,
  };
}

export function analyseWesternPair(category: CompatibilityCategory, a: WesternChart, b: WesternChart): WesternPairAnalysis {
  const focus = CATEGORY_ANALYSIS[category].westernFocus;
  const overlays: HouseOverlay[] = [];
  const omitted: { from: PersonIndex; into: PersonIndex }[] = [];
  for (const [from, into] of [
    [0, 1],
    [1, 0],
  ] as [PersonIndex, PersonIndex][]) {
    const result = overlay(from === 0 ? a : b, into === 0 ? a : b, from, into);
    if (result) overlays.push(result);
    else omitted.push({ from, into });
  }
  return {
    kind: "western",
    category,
    people: [westernPerson(a), westernPerson(b)],
    interAspects: interAspects(a, b, focus),
    overlays,
    overlaysOmitted: omitted,
    focusBodies: [...focus],
  };
}

export function analysePair(category: CompatibilityCategory, a: ChartData, b: ChartData): PairAnalysis {
  if (a.kind === "vedic" && b.kind === "vedic") return analyseIndianPair(category, a, b);
  if (a.kind === "western" && b.kind === "western") return analyseWesternPair(category, a, b);
  throw new Error("Both charts must use the same tradition");
}

/** Sign of a longitude, exported for chart graphics. */
export const signOf = signFromLongitude;
