import type { NakshatraKey, PlanetKey, SignKey, VedicGraha, WesternBody } from "./constants";

/**
 * Chart data produced by the calculation layer. This is the ONLY source of chart
 * facts for reports: the AI interprets it but never produces positions itself.
 *
 * Every fact carries its certainty. When the birth time is unknown or approximate we
 * evaluate the chart across the whole possible time window and report a value only
 * if it is the same throughout; otherwise we list the candidates or omit it.
 */
export type OmissionReason = "birth_time_unknown" | "polar_latitude";

export type Fact<T> =
  | { status: "known"; value: T }
  | { status: "uncertain"; candidates: T[]; atStatedTime: T | null }
  | { status: "omitted"; reason: OmissionReason };

export type TimeCertainty = "exact" | "approximate" | "unknown";

export interface CalculationWindow {
  certainty: TimeCertainty;
  /** ISO instant of the stated birth time (null when unknown). */
  statedUtc: string | null;
  /** Earliest and latest possible birth instants that were evaluated. */
  startUtc: string;
  endUtc: string;
  windowMinutes: number | null;
}

export interface Conventions {
  zodiac: "sidereal" | "tropical";
  ayanamsa: "lahiri" | null;
  houseSystem: "whole_sign" | "placidus" | "porphyry" | null;
  nodes: "mean" | null;
  dasha: "vimshottari" | null;
  dashaYearDays: number | null;
  ephemeris: string;
  timeZoneDatabase: string;
  notes: string[];
}

export interface Placement {
  key: PlanetKey;
  /** Longitude (0-360) at the stated time; null when the birth time is unknown. */
  longitude: number | null;
  /** Min/max longitude across the possible birth window (degrees, may wrap past 360). */
  longitudeRange: [number, number];
  sign: Fact<SignKey>;
  house: Fact<number>;
  retrograde: boolean;
  nakshatra?: Fact<NakshatraKey>;
  pada?: Fact<number>;
  dignity?: Fact<Dignity>;
}

export type Dignity = "exalted" | "debilitated" | "own_sign" | "domicile" | "detriment" | "fall" | "neutral";

export interface AnglePoint {
  longitude: number;
  sign: SignKey;
}

export interface DashaPeriod {
  lord: VedicGraha;
  start: string; // ISO date
  end: string; // ISO date
  subPeriods?: DashaPeriod[];
}

export interface DashaTimeline {
  lordAtBirth: VedicGraha;
  balanceAtBirthYears: number;
  mahadashas: DashaPeriod[];
  /** Max shift (days) of period boundaries across an approximate birth-time window. */
  uncertaintyDays: number;
}

export interface TransitPeriod {
  body: "saturn" | "jupiter";
  /** What is being transited: natal body/angle or a sign relative to the Moon. */
  target: string;
  aspect: "conjunction" | "square" | "opposition" | "trine" | "return" | "sign";
  start: string; // ISO date
  end: string; // ISO date
  detail?: string;
}

export interface VedicChart {
  kind: "vedic";
  window: CalculationWindow;
  conventions: Conventions;
  ayanamsaDegrees: number;
  lagna: Fact<{ sign: SignKey; longitude: number; nakshatra: NakshatraKey; pada: number }>;
  moonSign: Fact<SignKey>;
  moonNakshatra: Fact<NakshatraKey>;
  moonPada: Fact<number>;
  sunSign: Fact<SignKey>;
  grahas: Placement[];
  dasha: Fact<DashaTimeline>;
  dashaLordAtBirth: Fact<VedicGraha>;
  panchanga: {
    tithi: Fact<number>; // 1-30
    paksha: Fact<"shukla" | "krishna">;
    yoga: Fact<number>; // 1-27
    vara: Fact<number>; // 0 = Sunday (sunrise-to-sunrise Hindu weekday)
  };
  calendars: {
    tamilSolarMonth: Fact<number>; // 0 = Chithirai
    amantaMonth: Fact<{ index: number; adhika: boolean }>; // 0 = Chaitra
    purnimantaMonth: Fact<{ index: number; adhika: boolean }>;
  };
  transits: {
    sadeSati: TransitPeriod[];
    jupiterFromMoon: TransitPeriod[];
    saturnFromMoon: TransitPeriod[];
  };
}

export interface Aspect {
  a: WesternBody | "ascendant" | "midheaven";
  b: WesternBody | "ascendant" | "midheaven";
  type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  orb: number;
}

export interface WesternChart {
  kind: "western";
  window: CalculationWindow;
  conventions: Conventions;
  bodies: Placement[];
  ascendant: Fact<AnglePoint>;
  midheaven: Fact<AnglePoint>;
  houseCusps: number[] | null;
  aspects: Aspect[];
  /** Aspects that exist at the stated time but not across the whole possible window. */
  uncertainAspects: Aspect[];
  sect: Fact<"day" | "night">;
  elementBalance: Record<"fire" | "earth" | "air" | "water", number>;
  modalityBalance: Record<"cardinal" | "fixed" | "mutable", number>;
  transits: TransitPeriod[];
}

export type ChartData = VedicChart | WesternChart;

export interface ChartInput {
  tradition: "indian" | "western";
  timeCertainty: TimeCertainty;
  /** Stated birth instant (exact/approximate) - null when unknown. */
  birthUtcMs: number | null;
  windowMinutes: number | null;
  /** When the time is unknown, the whole local birth day is evaluated. */
  dayStartUtcMs: number;
  dayEndUtcMs: number;
  /** Local civil birth date (used for the sunrise-based weekday). */
  localDate: { year: number; month: number; day: number };
  latitude: number;
  longitude: number;
  timeZoneId: string;
  /** "Now" for timelines (injected for deterministic tests). */
  referenceDate: Date;
}

export interface ChartResult {
  provider: string;
  providerVersion: string;
  calculationVersion: string;
  settings: Record<string, string | number | boolean | null>;
  chart: ChartData;
}
