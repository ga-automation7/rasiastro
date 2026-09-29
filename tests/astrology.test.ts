import { describe, expect, it } from "vitest";
import type { ChartInput, VedicChart, WesternChart } from "@/domain/astrology/chart-types";
import { localDayRange, resolveLocalTime } from "@/domain/birth-time";
import { lahiriMeanAyanamsa } from "@/server/astrology/ayanamsa";
import { nakshatraIndex, padaOf, vimshottariTimeline } from "@/server/astrology/dasha";
import { astroTime, meanNodeLongitude, tropicalLongitude } from "@/server/astrology/ephemeris";
import { computeAngles, placidusCusps } from "@/server/astrology/houses";
import { buildVedicChart } from "@/server/astrology/vedic";
import { buildWesternChart } from "@/server/astrology/western";

// Delta T (TT - UT) in 1992 was about 59 seconds.
const DELTA_T_1992 = 59_000;

describe("ephemeris against published reference values", () => {
  it("Sun, 1992-10-13 0h TT (Meeus, Astronomical Algorithms, ex. 25.b: 199°54'21.8\")", () => {
    const lon = tropicalLongitude("sun", astroTime(Date.UTC(1992, 9, 13) - DELTA_T_1992));
    expect(lon).toBeCloseTo(199.90606, 2);
  });

  it("Moon, 1992-04-12 0h TT (Meeus ex. 47.a: apparent longitude 133.16°)", () => {
    const lon = tropicalLongitude("moon", astroTime(Date.UTC(1992, 3, 12) - DELTA_T_1992));
    expect(Math.abs(lon - 133.162655)).toBeLessThan(0.02); // within about one arcminute
  });

  it("mean lunar node (Meeus ex. 47.a: 274.400656°)", () => {
    expect(meanNodeLongitude(astroTime(Date.UTC(1992, 3, 12) - DELTA_T_1992))).toBeCloseTo(274.4007, 3);
  });

  it("Lahiri ayanamsa at J2000 is 23°51'25\" (mean)", () => {
    expect(lahiriMeanAyanamsa(astroTime(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(23.857, 2);
  });
});

describe("houses", () => {
  it("reproduces a standard table of houses for London at sidereal time 0h", () => {
    const lat = 51 + 32 / 60;
    const angles = computeAngles(0, 0, lat, 23.44);
    expect(angles.midheaven).toBeCloseTo(0, 5);
    expect(angles.ascendant).toBeCloseTo(116.6, 0); // Cancer 26°36'
    const cusps = placidusCusps(angles, lat, 23.44)!;
    expect(cusps[10]).toBeCloseTo(38.7, 0); // 11th: Taurus 9
    expect(cusps[11]).toBeCloseTo(82.5, 0); // 12th: Gemini 22
  });

  it("gives equal right-ascension divisions at the equator", () => {
    const angles = computeAngles(0, 0, 0, 23.44);
    expect(angles.ascendant).toBeCloseTo(90, 5);
  });

  it("returns null (so we fall back) where Placidus is undefined", () => {
    expect(placidusCusps(computeAngles(100, 0, 70, 23.44), 70, 23.44)).toBeNull();
  });
});

describe("nakshatra, pada and Vimshottari dasha", () => {
  it("divides the zodiac into 27 nakshatras of 13°20' and 4 padas", () => {
    expect(nakshatraIndex(0)).toBe(0);
    expect(nakshatraIndex(13.3334)).toBe(1);
    expect(nakshatraIndex(359.99)).toBe(26);
    expect(padaOf(40 + 0.1)).toBe(1); // Rohini starts at 40°
    expect(padaOf(40 + 3.34)).toBe(2);
  });

  it("starts with the nakshatra lord and a proportional balance", () => {
    // Moon at 16°33' Taurus sidereal = 46.55°, in Rohini (lord: Moon, 10 years).
    const timeline = vimshottariTimeline(46.55, Date.UTC(1990, 7, 15, 1));
    expect(timeline.lordAtBirth).toBe("moon");
    expect(timeline.balanceAtBirthYears).toBeCloseTo(5.09, 1);
    expect(timeline.mahadashas.map((m) => m.lord).slice(0, 4)).toEqual(["moon", "mars", "rahu", "jupiter"]);
    const first = timeline.mahadashas[1]!.subPeriods!;
    expect(first).toHaveLength(9);
    expect(first[0]!.lord).toBe("mars");
  });
});

function sampleInput(certainty: "exact" | "approximate" | "unknown", tradition: "indian" | "western", place = { lat: 13.0827, lon: 80.2707, tz: "Asia/Kolkata" }): ChartInput {
  const date = { year: 1990, month: 8, day: 15 };
  const r = resolveLocalTime(place.tz, date, { hour: 6, minute: 30 });
  if (r.kind !== "unique") throw new Error("ambiguous");
  const day = localDayRange(place.tz, date);
  return {
    tradition,
    timeCertainty: certainty,
    birthUtcMs: certainty === "unknown" ? null : r.instant.utcMs,
    windowMinutes: certainty === "approximate" ? 60 : null,
    dayStartUtcMs: day.startMs,
    dayEndUtcMs: day.endMs,
    localDate: date,
    latitude: place.lat,
    longitude: place.lon,
    timeZoneId: place.tz,
    referenceDate: new Date("2026-09-01"),
  };
}

describe("Vedic chart (Chennai, 15 Aug 1990, 06:30 IST)", () => {
  const chart = buildVedicChart(sampleInput("exact", "indian")) as VedicChart;

  it("calculates Rasi, nakshatra, pada and Lagna", () => {
    expect(chart.moonSign).toEqual({ status: "known", value: "taurus" });
    expect(chart.moonNakshatra).toEqual({ status: "known", value: "rohini" });
    expect(chart.moonPada).toEqual({ status: "known", value: 2 });
    expect(chart.lagna.status === "known" && chart.lagna.value.sign).toBe("leo");
  });

  it("calculates panchanga and regional calendar markers", () => {
    expect(chart.panchanga.vara).toEqual({ status: "known", value: 3 }); // Wednesday
    expect(chart.panchanga.tithi).toEqual({ status: "known", value: 25 }); // Krishna Dashami
    expect(chart.calendars.tamilSolarMonth).toEqual({ status: "known", value: 3 }); // Aadi
    expect(chart.calendars.amantaMonth).toEqual({ status: "known", value: { index: 4, adhika: false } }); // Shravana
    expect(chart.calendars.purnimantaMonth).toEqual({ status: "known", value: { index: 5, adhika: false } }); // Bhadrapada
  });

  it("marks dignities and retrograde planets", () => {
    const g = (k: string) => chart.grahas.find((x) => x.key === k)!;
    expect(g("moon").dignity).toEqual({ status: "known", value: "exalted" });
    expect(g("jupiter").dignity).toEqual({ status: "known", value: "exalted" });
    expect(g("mars").dignity).toEqual({ status: "known", value: "own_sign" });
    expect(g("saturn").retrograde).toBe(true);
    expect(g("mars").house).toEqual({ status: "known", value: 9 });
  });

  it("finds Sade Sati periods (Saturn around a Taurus Moon)", () => {
    expect(chart.transits.sadeSati.map((p) => p.start.slice(0, 4))).toEqual(["1998", "2027"]);
  });
});

describe("unknown and approximate birth times", () => {
  it("omits the Lagna, houses and dasha dates when the time is unknown - never assumes noon", () => {
    const chart = buildVedicChart(sampleInput("unknown", "indian")) as VedicChart;
    expect(chart.window.statedUtc).toBeNull();
    expect(chart.lagna).toEqual({ status: "omitted", reason: "birth_time_unknown" });
    expect(chart.dasha.status).toBe("omitted");
    expect(chart.grahas.every((g) => g.house.status === "omitted" && g.longitude === null)).toBe(true);
    // The Moon changed nakshatra that day: both are shown as possibilities.
    expect(chart.moonNakshatra).toEqual({ status: "uncertain", candidates: ["rohini", "mrigashira"], atStatedTime: null });
    expect(chart.moonSign).toEqual({ status: "known", value: "taurus" });
  });

  it("reports facts that change within an approximate window as uncertain", () => {
    const chart = buildVedicChart(sampleInput("approximate", "indian")) as VedicChart;
    expect(chart.lagna.status).toBe("uncertain");
    if (chart.lagna.status === "uncertain") {
      expect(chart.lagna.candidates.map((c) => c.sign)).toEqual(["cancer", "leo"]);
      expect(chart.lagna.atStatedTime?.sign).toBe("leo");
    }
    expect(chart.dasha.status).toBe("known");
    if (chart.dasha.status === "known") expect(chart.dasha.value.uncertaintyDays).toBeGreaterThan(0);
  });

  it("Western chart without a time has no Ascendant, MC or houses", () => {
    const chart = buildWesternChart(sampleInput("unknown", "western")) as WesternChart;
    expect(chart.ascendant.status).toBe("omitted");
    expect(chart.midheaven.status).toBe("omitted");
    expect(chart.houseCusps).toBeNull();
    expect(chart.conventions.houseSystem).toBeNull();
  });

  it("uses Placidus normally and Porphyry above the Arctic Circle", () => {
    const chennai = buildWesternChart(sampleInput("exact", "western")) as WesternChart;
    expect(chennai.conventions.houseSystem).toBe("placidus");
    expect(chennai.bodies.find((b) => b.key === "sun")!.sign).toEqual({ status: "known", value: "leo" });
    const tromso = buildWesternChart(sampleInput("exact", "western", { lat: 69.6492, lon: 18.9553, tz: "Europe/Oslo" })) as WesternChart;
    expect(tromso.conventions.houseSystem).toBe("porphyry");
    expect(tromso.conventions.notes).toContain("porphyry_fallback_high_latitude");
  });
});
