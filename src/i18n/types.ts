import type { LanguageCode } from "@/config/languages";
import type { Aspect, Dignity } from "@/domain/astrology/chart-types";
import type { NakshatraKey, PlanetKey, SignKey } from "@/domain/astrology/constants";

/**
 * Fixed report text for one language. AI-written prose is produced directly in the
 * report language; everything structural (headings, labels, names, disclaimers,
 * emails) comes from these dictionaries so it is consistent and reviewable.
 */
export interface ReportDictionary {
  code: LanguageCode;
  /** BCP-47 locale for dates and numbers. */
  locale: string;
  sections: {
    reportTitleIndian: string;
    reportTitleWestern: string;
    overview: string;
    birthDetails: string;
    conventions: string;
    limitations: string;
    chartFacts: string;
    chartExplanations: string;
    charts: string;
    planets: string;
    aspects: string;
    perspectivesIndian: string;
    perspectivesWestern: string;
    lookingBack: string;
    lookingAhead: string;
    lifeAreas: string;
    agreeDiffer: string;
    summary: string;
    yourContext: string;
    discrepancies: string;
    questions: string;
    about: string;
  };
  notes: {
    regionalPerspectives: string;
    westernPerspectives: string;
    lookingBackNote: string;
    demoBanner: string;
    sampleBanner: string;
    noPeriods: string;
    northChartNeedsTime: string;
  };
  labels: {
    name: string;
    dateOfBirth: string;
    timeOfBirth: string;
    placeOfBirth: string;
    coordinates: string;
    timeZone: string;
    orderReference: string;
    generatedOn: string;
    reportLanguage: string;
    timeExact: string;
    timeApproximate: (minutes: number) => string;
    timeUnknown: string;
    planet: string;
    sign: string;
    degree: string;
    nakshatra: string;
    pada: string;
    house: string;
    dignity: string;
    retrograde: string;
    lagna: string;
    rasi: string;
    moonSign: string;
    sunSign: string;
    ascendant: string;
    midheaven: string;
    janmaNakshatra: string;
    tithi: string;
    vara: string;
    tamilMonth: string;
    amantaMonth: string;
    purnimantaMonth: string;
    adhika: string;
    dashaAtBirth: string;
    currentDasha: string;
    ayanamsa: string;
    sect: string;
    dayChart: string;
    nightChart: string;
    elementBalance: string;
    modalityBalance: string;
    orb: string;
    oneOf: string;
    notCalculated: string;
    customerSaid: string;
    calculated: string;
    period: string;
    dates: string;
    opportunities: string;
    challenges: string;
    agreements: string;
    differences: string;
    career: string;
    relationships: string;
    personalGrowth: string;
    money: string;
    question: (n: number) => string;
    southIndianChart: string;
    northIndianChart: string;
    dashaShift: (days: number) => string;
    downloadPdf: string;
    page: string;
  };
  periods: {
    mahadasha: (lord: string) => string;
    antardasha: (lord: string, parent: string) => string;
    sadeSati: string;
    saturnFromMoon: (house: number) => string;
    jupiterFromMoon: (house: number) => string;
    transit: (body: string, aspect: string, target: string) => string;
    planetReturn: (body: string) => string;
  };
  signs: Record<SignKey, string>;
  nakshatras: Record<NakshatraKey, string>;
  planets: Record<PlanetKey, string>;
  /** Short forms used inside chart diagrams. */
  planetAbbr: Record<PlanetKey | "lagna", string>;
  /** Marker for retrograde planets in chart diagrams. */
  retroMark: string;
  weekdays: [string, string, string, string, string, string, string];
  /** Tithi names 1-14, then full moon, then new moon. */
  tithis: string[];
  pakshas: { shukla: string; krishna: string };
  tamilMonths: string[];
  lunarMonths: string[];
  dignities: Record<Dignity, string>;
  aspects: Record<Aspect["type"], string>;
  elements: Record<"fire" | "earth" | "air" | "water", string>;
  modalities: Record<"cardinal" | "fixed" | "mutable", string>;
  angles: { ascendant: string; midheaven: string };
  conventions: Record<string, string>;
  limitations: {
    timeUnknownIndian: string;
    timeUnknownWestern: string;
    timeApproximate: (minutes: number) => string;
    polar: string;
    general: string;
  };
  discrepancy: {
    fields: Record<"moon_sign" | "nakshatra" | "pada" | "ascendant", string>;
    verdicts: Record<"match" | "mismatch" | "possible" | "unverifiable", string>;
  };
  disclaimer: string;
  email: {
    readySubject: (reference: string) => string;
    readyIntro: string;
    openButton: string;
    linkExpiry: (date: string) => string;
    recoverHint: string;
    support: (email: string) => string;
    recoverySubject: string;
    recoveryIntro: string;
    reportFor: (reference: string, tradition: string) => string;
  };
}
