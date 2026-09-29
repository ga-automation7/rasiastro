import type { ChartInput, Conventions, DashaTimeline, Fact, Placement, VedicChart } from "@/domain/astrology/chart-types";
import {
  NAKSHATRA_KEYS,
  SIGN_KEYS,
  VEDIC_GRAHAS,
  normalizeDegrees,
  signFromLongitude,
  signIndexFromLongitude,
  type SignKey,
  type VedicGraha,
} from "@/domain/astrology/constants";
import { tzDatabaseVersion } from "@/domain/birth-time";
import { lahiriMeanAyanamsa, meanEquinoxToSidereal, toSidereal } from "./ayanamsa";
import { DASHA_YEAR_DAYS, maxBoundaryShiftDays, nakshatraIndex, nakshatraLord, padaOf, vimshottariTimeline } from "./dasha";
import { vedicDignity } from "./dignities";
import { EPHEMERIS_NAME, astroTime, dailyMotion, earthOrientation, meanNodeLongitude, nextSunrise, surroundingNewMoons, tropicalLongitude } from "./ephemeris";
import { factFromSamples, longitudeRange, round4 } from "./facts";
import { computeAngles, wholeSignHouse } from "./houses";
import { planSamples, statedIndex } from "./sampling";
import { fromMoonSignPeriods, sadeSatiPeriods } from "./transits";

interface Snapshot {
  t: number;
  sidereal: Record<VedicGraha, number>;
  lagna: number | null;
}

function snapshot(t: number, input: ChartInput, withLagna: boolean): Snapshot {
  const time = astroTime(t);
  const tropical = (body: Exclude<VedicGraha, "rahu" | "ketu">) => toSidereal(tropicalLongitude(body, time), time);
  const rahu = meanEquinoxToSidereal(meanNodeLongitude(time), time);
  const sidereal: Record<VedicGraha, number> = {
    sun: tropical("sun"),
    moon: tropical("moon"),
    mars: tropical("mars"),
    mercury: tropical("mercury"),
    jupiter: tropical("jupiter"),
    venus: tropical("venus"),
    saturn: tropical("saturn"),
    rahu,
    ketu: normalizeDegrees(rahu + 180),
  };
  let lagna: number | null = null;
  if (withLagna) {
    const orientation = earthOrientation(time);
    const angles = computeAngles(orientation.gastDegrees, input.longitude, input.latitude, orientation.trueObliquity);
    lagna = toSidereal(angles.ascendant, time);
  }
  return { t, sidereal, lagna };
}

const tithiOf = (s: Snapshot) => Math.floor(normalizeDegrees(s.sidereal.moon - s.sidereal.sun) / 12) + 1;
const yogaOf = (s: Snapshot) => Math.floor(normalizeDegrees(s.sidereal.moon + s.sidereal.sun) / (360 / 27)) + 1;

/** Hindu weekday runs sunrise to sunrise: a birth before local sunrise belongs to the previous day. */
function varaOf(t: number, input: ChartInput): number {
  const civil = new Date(Date.UTC(input.localDate.year, input.localDate.month - 1, input.localDate.day)).getUTCDay();
  const sunrise = nextSunrise(input.dayStartUtcMs, input.latitude, input.longitude);
  if (sunrise === null || sunrise > input.dayEndUtcMs) return civil; // polar day/night: civil weekday
  return t < sunrise ? (civil + 6) % 7 : civil;
}

function lunarMonth(t: number): { index: number; adhika: boolean } {
  const { previous, next } = surroundingNewMoons(t);
  const sunSignAt = (ms: number) => {
    const time = astroTime(ms);
    return signIndexFromLongitude(toSidereal(tropicalLongitude("sun", time), time));
  };
  const startSign = sunSignAt(previous);
  // Amanta rule: the month is named from the Sun's sign at the new moon that begins
  // it (Sun in Meena -> Chaitra). No solar ingress during the month makes it adhika.
  return { index: (startSign + 1) % 12, adhika: startSign === sunSignAt(next) };
}

export function buildVedicChart(input: ChartInput): VedicChart {
  const plan = planSamples(input);
  const snaps = plan.samples.map((t) => snapshot(t, input, plan.timeKnown));
  const statedSnap = plan.stated === null ? null : snaps[statedIndex(plan)]!;
  const middle = snaps[statedIndex(plan)]!;
  const stated = <T>(fn: (s: Snapshot) => T): T | null => (statedSnap ? fn(statedSnap) : null);

  const lagnaFact: VedicChart["lagna"] = plan.timeKnown
    ? factFromSamples(
        snaps.map((s) => lagnaValue(s.lagna!)),
        stated((s) => lagnaValue(s.lagna!)),
        (a, b) => a.sign === b.sign,
      )
    : { status: "omitted", reason: "birth_time_unknown" };

  const grahas: Placement[] = VEDIC_GRAHAS.map((graha) => {
    const longitudes = snaps.map((s) => s.sidereal[graha]);
    const signFact = factFromSamples(longitudes.map(signFromLongitude), stated((s) => signFromLongitude(s.sidereal[graha])));
    const house: Fact<number> = plan.timeKnown
      ? factFromSamples(
          snaps.map((s) => wholeSignHouse(s.sidereal[graha], s.lagna!)),
          stated((s) => wholeSignHouse(s.sidereal[graha], s.lagna!)),
        )
      : { status: "omitted", reason: "birth_time_unknown" };
    const retrograde =
      graha === "rahu" || graha === "ketu" ? true : graha === "sun" || graha === "moon" ? false : dailyMotion(graha, astroTime(middle.t)) < 0;
    const dignitySamples = longitudes.map((l) => vedicDignity(graha, signFromLongitude(l)));
    const placement: Placement = {
      key: graha,
      longitude: statedSnap ? round4(statedSnap.sidereal[graha]) : null,
      longitudeRange: longitudeRange(longitudes),
      sign: signFact,
      house,
      retrograde,
      nakshatra: factFromSamples(
        longitudes.map((l) => NAKSHATRA_KEYS[nakshatraIndex(l)]!),
        stated((s) => NAKSHATRA_KEYS[nakshatraIndex(s.sidereal[graha])]!),
      ),
      pada: factFromSamples(longitudes.map(padaOf), stated((s) => padaOf(s.sidereal[graha]))),
    };
    if (dignitySamples.every((d) => d !== null)) {
      placement.dignity = factFromSamples(
        dignitySamples as NonNullable<(typeof dignitySamples)[number]>[],
        stated((s) => vedicDignity(graha, signFromLongitude(s.sidereal[graha]))),
      );
    }
    return placement;
  });

  const moon = grahas.find((g) => g.key === "moon")!;
  const sun = grahas.find((g) => g.key === "sun")!;
  const moonLongitudes = snaps.map((s) => s.sidereal.moon);

  // Dasha periods need the Moon's exact position at birth.
  const lordFact = factFromSamples(
    moonLongitudes.map((l) => nakshatraLord(nakshatraIndex(l))),
    stated((s) => nakshatraLord(nakshatraIndex(s.sidereal.moon))),
  );
  let dasha: Fact<DashaTimeline>;
  if (plan.stated === null) {
    dasha = { status: "omitted", reason: "birth_time_unknown" };
  } else {
    const timeline = vimshottariTimeline(statedSnap!.sidereal.moon, plan.stated);
    if (lordFact.status === "known" && snaps.length > 1) {
      const first = vimshottariTimeline(snaps[0]!.sidereal.moon, snaps[0]!.t);
      const last = vimshottariTimeline(snaps[snaps.length - 1]!.sidereal.moon, snaps[snaps.length - 1]!.t);
      timeline.uncertaintyDays = Math.max(maxBoundaryShiftDays(timeline, first), maxBoundaryShiftDays(timeline, last));
    }
    dasha = lordFact.status === "known" ? { status: "known", value: timeline } : { status: "uncertain", candidates: [], atStatedTime: timeline };
  }

  const monthSamples = [...new Set([plan.samples[0]!, plan.stated ?? plan.samples[0]!, plan.samples[plan.samples.length - 1]!])];
  const months = monthSamples.map(lunarMonth);
  const statedMonth = plan.stated === null ? null : lunarMonth(plan.stated);
  const amanta = factFromSamples(months, statedMonth, (a, b) => a.index === b.index && a.adhika === b.adhika);
  const tithiSamples = snaps.map(tithiOf);
  const pakshaOf = (tithi: number) => (tithi <= 15 ? ("shukla" as const) : ("krishna" as const));
  const purnimanta: Fact<{ index: number; adhika: boolean }> = (() => {
    const shift = (m: { index: number; adhika: boolean }, tithi: number) => ({ index: pakshaOf(tithi) === "krishna" ? (m.index + 1) % 12 : m.index, adhika: m.adhika });
    const values = monthSamples.map((t, i) => shift(months[i]!, tithiOf(snapshot(t, input, false))));
    const statedValue = statedMonth && statedSnap ? shift(statedMonth, tithiOf(statedSnap)) : null;
    return factFromSamples(values, statedValue, (a, b) => a.index === b.index && a.adhika === b.adhika);
  })();

  const moonSignKnown = moon.sign.status === "known" ? SIGN_KEYS.indexOf(moon.sign.value) : null;
  const reference = input.referenceDate.getTime();
  const yearMs = 365.25 * 86_400_000;
  const birthMs = plan.stated ?? input.dayStartUtcMs;

  const conventions: Conventions = {
    zodiac: "sidereal",
    ayanamsa: "lahiri",
    houseSystem: plan.timeKnown ? "whole_sign" : null,
    nodes: "mean",
    dasha: "vimshottari",
    dashaYearDays: DASHA_YEAR_DAYS,
    ephemeris: EPHEMERIS_NAME,
    timeZoneDatabase: `IANA tz ${tzDatabaseVersion() ?? "(runtime)"}`,
    notes: [
      "sidereal_lahiri",
      "whole_sign_houses",
      "mean_nodes",
      "vimshottari_julian_years",
      "tamil_month_by_solar_sign",
      "lunar_month_amanta_purnimanta",
      "weekday_sunrise_to_sunrise",
    ],
  };

  return {
    kind: "vedic",
    window: plan.window,
    conventions,
    ayanamsaDegrees: round4(lahiriMeanAyanamsa(astroTime(middle.t))),
    lagna: lagnaFact,
    moonSign: moon.sign,
    moonNakshatra: moon.nakshatra!,
    moonPada: moon.pada!,
    sunSign: sun.sign,
    grahas,
    dasha,
    dashaLordAtBirth: lordFact,
    panchanga: {
      tithi: factFromSamples(tithiSamples, stated(tithiOf)),
      paksha: factFromSamples(tithiSamples.map(pakshaOf), stated((s) => pakshaOf(tithiOf(s)))),
      yoga: factFromSamples(snaps.map(yogaOf), stated(yogaOf)),
      vara: factFromSamples(snaps.map((s) => varaOf(s.t, input)), plan.stated === null ? null : varaOf(plan.stated, input)),
    },
    calendars: {
      tamilSolarMonth: mapFact(sun.sign, (sign) => SIGN_KEYS.indexOf(sign)),
      amantaMonth: amanta,
      purnimantaMonth: purnimanta,
    },
    transits:
      moonSignKnown === null
        ? { sadeSati: [], jupiterFromMoon: [], saturnFromMoon: [] }
        : {
            sadeSati: sadeSatiPeriods(moonSignKnown, birthMs, reference + 10 * yearMs),
            // Scan from well before today so the current stay shows its true start date.
            jupiterFromMoon: fromMoonSignPeriods("jupiter", moonSignKnown, reference - 1.5 * yearMs, reference + 2 * yearMs),
            saturnFromMoon: fromMoonSignPeriods("saturn", moonSignKnown, reference - 3 * yearMs, reference + 3 * yearMs),
          },
  };
}

function lagnaValue(longitude: number) {
  return {
    sign: signFromLongitude(longitude) as SignKey,
    longitude: round4(longitude),
    nakshatra: NAKSHATRA_KEYS[nakshatraIndex(longitude)]!,
    pada: padaOf(longitude),
  };
}

function mapFact<T, U>(fact: Fact<T>, fn: (value: T) => U): Fact<U> {
  if (fact.status === "known") return { status: "known", value: fn(fact.value) };
  if (fact.status === "uncertain") {
    return { status: "uncertain", candidates: fact.candidates.map(fn), atStatedTime: fact.atStatedTime === null ? null : fn(fact.atStatedTime) };
  }
  return fact;
}
