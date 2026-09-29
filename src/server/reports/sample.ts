import { localDayRange, resolveLocalTime } from "@/domain/birth-time";
import { builtInCalculationProvider } from "../astrology/provider";
import { buildInterpretationInput } from "../interpretation/input";
import { PROMPT_VERSION } from "../interpretation/prompt-v1";
import type { CorePart, SynthesisPart, TimelinePart } from "../interpretation/schema";
import { REPORT_SCHEMA_VERSION } from "../interpretation/schema";
import { validatePart } from "../interpretation/validate";
import { findDiscrepancies } from "./discrepancies";
import type { ReportDocument } from "./document";
import { selectPeriods, type ReportPeriod } from "./periods";

/**
 * The public SAMPLE report: a fictional person, a genuinely calculated chart, and
 * hand-written illustrative text (not AI output) that matches that chart. It is
 * labelled as a sample everywhere it appears.
 */
const REFERENCE_DATE = "2026-09-01";
const SAMPLE_BIRTH = { date: { year: 1990, month: 8, day: 15 }, time: { hour: 6, minute: 30 }, tz: "Asia/Kolkata", lat: 13.0827, lon: 80.2707 };
const QUESTIONS = [
  "What themes may shape my career over the next two years?",
  "How can I bring more steadiness to my close relationships?",
  "What should I keep in mind when Sade Sati begins?",
];

const CORE: CorePart = {
  overview: {
    headline: "A warm, visible Leo rising chart anchored by an exalted Moon",
    paragraphs: [
      "This chart has a clear centre of gravity. Simha (Leo) rises, with Mercury sitting in the first house beside the Lagna, so the personality tends to be expressive, articulate and noticed. The Moon, the most personal factor in Indian astrology, is exalted in Vrishabha (Taurus) in the tenth house of work and reputation - a classic signature of emotional steadiness that shows up in public life.",
      "At the same time, four placements gather in Karka (Cancer) in the twelfth house: the Sun, an exalted Jupiter, Venus and Ketu. The twelfth is the house of retreat, study, travel and the inner life. Read together with the Leo Lagna, the chart may describe someone who is outwardly confident but draws strength from quiet, private time and from caring for others behind the scenes.",
      "Mars in its own sign in the ninth and Saturn in the fifth add drive and seriousness around learning, beliefs and creative work. The report below explains each of these calculated facts, then reads the same chart through Tamil, Kannada and North Indian lenses before looking at past and upcoming periods.",
    ],
  },
  chartExplanations: [
    { factId: "lagna", explanation: "The Lagna is the sign rising on the eastern horizon at the moment of birth. Simha (Leo) rising at about 5 degrees suggests a natural presence and a wish to lead with warmth. Because the Lagna depends on the exact birth time, it is the most time-sensitive fact in the chart." },
    { factId: "moon_sign", explanation: "The Rasi, or Moon sign, is Vrishabha (Taurus). The Moon is considered exalted here - at its most comfortable - which traditionally points to emotional steadiness, loyalty and an appreciation of beauty and security." },
    { factId: "nakshatra", explanation: "The Moon falls in Rohini nakshatra, pada 2. Rohini is ruled by the Moon itself and is associated with growth, creativity and attraction. It also sets the Vimshottari dasha sequence, starting with a Moon period at birth." },
    { factId: "planet_jupiter", explanation: "Jupiter is exalted in Karka (Cancer). In the twelfth house from the Lagna it is often read as generosity, a spiritual or reflective streak, and benefit from study or work in distant places." },
    { factId: "planet_mars", explanation: "Mars is in its own sign, Mesha (Aries), in the ninth house. This adds courage and conviction around beliefs, higher learning, mentors and long journeys, along with a certain impatience with rules that seem unfair." },
    { factId: "planet_saturn", explanation: "Saturn is retrograde in Dhanu (Sagittarius) in the fifth house. Saturn here asks for patience and discipline in creative work, study and, traditionally, matters concerning children. Retrograde Saturn is often read as lessons that are revisited and deepened over time." },
    { factId: "current_dasha", explanation: "The current Vimshottari period is Jupiter mahadasha (2020-2036), with Mercury as the sub-period until August 2027. Jupiter periods are traditionally linked to learning, guidance and expansion; Mercury sub-periods bring communication, skills and planning to the foreground." },
  ],
  perspectives: [
    {
      key: "tamil",
      keyThemes: ["Rohini's steady creativity", "Aadi month birth", "Saturn from the Rasi"],
      paragraphs: [
        "In Tamil practice the janma nakshatram and Rasi usually come first. Here that is Rohini in Rishabam, with the Moon exalted - a combination often described as gentle, artistic and dependable. The Moon as nakshatra lord and Rasi placement both point to the importance of emotional security and a settled home base.",
        "The birth falls in the Tamil solar month of Aadi, with the Sun in Kataka. The South Indian chart above places the Lagna (marked ல) in Simmam alongside Mercury, and shows the strong grouping of Sun, Jupiter, Venus and Ketu in Kataka.",
        "Tamil astrologers also track Saturn's movement counted from the Rasi. Saturn is currently in the eleventh sign from Rishabam, traditionally seen as a supportive position for gains through steady effort; from mid-2027 it moves into the twelfth, beginning the Sade Sati period discussed below.",
      ],
    },
    {
      key: "kannada",
      keyThemes: ["Shravana lunar month", "Rohini and the Moon period", "Structured growth"],
      paragraphs: [
        "In the amanta calendar used in Karnataka, this birth falls in the lunar month of Shravana, in the waning half (Krishna paksha) on the tenth tithi. These calendar markers are the same chart seen through the lunar calendar rather than the solar one.",
        "Kannada readings commonly give weight to the Moon's nakshatra and the Vimshottari periods. With Rohini's lord being the Moon and the Moon exalted, the early Moon period of childhood is traditionally read as nurturing, and the long Rahu period of the twenties as one of ambition and unconventional turns.",
        "The present Jupiter period, running until 2036, is read here as a phase for building knowledge and trust. With Jupiter exalted in the chart, this is usually one of the more constructive long periods, although the twelfth-house placement suggests its rewards often come through study, service or work away from home.",
      ],
    },
    {
      key: "north_indian",
      keyThemes: ["Leo Lagna and the Sun", "Tenth-house Moon", "Twelfth-house focus"],
      paragraphs: [
        "North Indian practice reads the chart house by house from the Lagna, as the diamond chart above shows. With Simha rising, the Sun is the Lagna lord; placed in the twelfth, it suggests that a sense of purpose may grow through reflection, foreign connections or work behind the scenes rather than constant public display.",
        "The exalted Moon in the tenth house (karma bhava) is a notable feature: public work that involves care, stability, food, design or people-facing roles often suits such a placement. Mercury in the first house adds communication skill and adaptability to the personality.",
        "In the purnimanta calendar common in North India, this birth falls in Bhadrapada Krishna paksha, a few days after Janmashtami. The same calculated chart underlies all three perspectives; only the calendars, naming and emphasis differ.",
      ],
    },
  ],
};

const PERIOD_TEXT: Record<string, { paragraphs: string[]; opportunities?: string[]; challenges?: string[] }> = {
  "maha:mars": { paragraphs: ["The Mars period of early school years may be remembered as energetic and competitive. With Mars strong in its own sign, this is a period in which courage and a sense of fairness could have first taken shape."] },
  "sadesati:past": { paragraphs: ["Saturn's first Sade Sati passed over the Moon sign roughly between 1998 and 2005. You may recognise this as a time when responsibilities felt heavier or when you had to adapt to changes in your surroundings, often leaving a lasting sense of resilience."] },
  "maha:rahu": { paragraphs: ["The long Rahu period, from 2002 to 2020, covers the teenage years and twenties. Rahu is associated with ambition, unconventional choices and the unfamiliar; you may recognise periods of rapid change, study or work in new environments, and a wish to prove yourself."] },
  "antar:jupiter:saturn": { paragraphs: ["The Saturn sub-period within Jupiter, from late 2022 to mid-2025, may have felt like consolidation: slower progress, more structure, and decisions about what is worth committing to over the long term."] },
  "maha:jupiter": {
    paragraphs: ["The Jupiter mahadasha runs until 2036 and sets the broad tone of this decade. With Jupiter exalted, it is traditionally one of the more supportive periods for learning, mentoring, spiritual interests and steady growth, though its benefits may come in quieter, less visible ways."],
    opportunities: ["Study, teaching or mentoring", "Building long-term trust"],
    challenges: ["Over-committing out of generosity"],
  },
  "saturn_moon:11": {
    paragraphs: ["Saturn's stay in the eleventh sign from the Moon (to mid-2027) is traditionally one of its better positions: patient effort, networks and older friends may bring steady rather than sudden gains."],
    opportunities: ["Steady gains through consistent work", "Supportive networks"],
    challenges: ["Impatience with slow results"],
  },
  "antar:jupiter:mercury": {
    paragraphs: ["The Mercury sub-period, until August 2027, emphasises communication, skills, writing and planning. With Mercury in the first house, this may be a good time to present your ideas clearly and to learn practical skills."],
    opportunities: ["Learning a new skill", "Writing or presenting"],
    challenges: ["Scattered attention"],
  },
  "jupiter_moon:3": {
    paragraphs: ["Jupiter's transit through the third sign from the Moon (to mid-2027) is traditionally a mixed position: more effort, short journeys and communication, with results that depend on initiative rather than luck."],
    opportunities: ["Short courses and local projects"],
    challenges: ["Effort that pays off only gradually"],
  },
  "sadesati:upcoming": {
    paragraphs: ["A second Sade Sati begins around June 2027 and continues to 2034. Despite its reputation, it is best read as a long season of maturing: clarifying priorities, simplifying commitments and building durable foundations. Nothing about it requires fear or paid remedies."],
    opportunities: ["Deepening skills and discipline", "Simplifying what no longer fits"],
    challenges: ["Periods of heavier responsibility"],
  },
  "jupiter_moon:4": {
    paragraphs: ["From mid-2027 Jupiter moves into the fourth sign from the Moon, a transit traditionally linked to home, family, property and emotional foundations."],
    opportunities: ["Attention to home and family"],
    challenges: ["Restlessness about where you belong"],
  },
  "antar:jupiter:ketu": {
    paragraphs: ["The Ketu sub-period from August 2027 to mid-2028 is often read as inward-looking: letting go, spiritual interests, and questioning what truly matters."],
    opportunities: ["Reflection and retreat"],
    challenges: ["Feeling detached or unsure"],
  },
};

function periodKey(p: ReportPeriod): string {
  switch (p.kind) {
    case "mahadasha":
      return `maha:${p.lord}`;
    case "antardasha":
      return `antar:${p.parentLord}:${p.lord}`;
    case "sade_sati":
      return p.when === "past" ? "sadesati:past" : "sadesati:upcoming";
    case "saturn_from_moon":
      return `saturn_moon:${p.house}`;
    case "jupiter_from_moon":
      return `jupiter_moon:${p.house}`;
    default:
      return p.id;
  }
}

function timelineFor(periods: ReportPeriod[]): TimelinePart {
  const withText = (when: "past" | "ahead") =>
    periods
      .filter((p) => (when === "past" ? p.when === "past" : p.when !== "past"))
      .filter((p, i, all) => PERIOD_TEXT[periodKey(p)] && all.findIndex((q) => periodKey(q) === periodKey(p)) === i)
      .map((p) => ({ periodId: p.id, ...PERIOD_TEXT[periodKey(p)]! }));
  return {
    lookingBack: {
      intro: "These are periods you may recognise. They describe possible patterns suggested by the chart, not events we know happened; take what resonates and leave the rest.",
      periods: withText("past").map(({ periodId, paragraphs }) => ({ periodId, paragraphs })),
    },
    lookingAhead: {
      intro: "The next few years combine the long, supportive Jupiter period with Saturn moving towards a new Sade Sati. Read these as themes to work with, not fixed outcomes.",
      periods: withText("ahead").map(({ periodId, paragraphs, opportunities, challenges }) => ({ periodId, paragraphs, opportunities: opportunities ?? [], challenges: challenges ?? [] })),
    },
    lifeAreas: {
      career: [
        "The exalted Moon in the tenth house is the chart's clearest career signature: work that involves care, consistency and people's trust tends to suit it, and reputation can grow steadily. Mercury rising adds communication and presentation.",
        "Over the next two years the Mercury sub-period favours skills, writing and planning. Rather than dramatic moves, the chart suggests building credibility step by step.",
      ],
      relationships: [
        "Venus with Jupiter in Cancer points to affection expressed through care, loyalty and family feeling. In the twelfth house, closeness may matter most in private, unhurried time together.",
        "The Leo Lagna likes to give generously; the lesson may be to also ask for support directly rather than assuming others will notice.",
      ],
      personalGrowth: [
        "Four planets in the twelfth house suggest that reflection, study, travel or quiet service replenish energy. Regular time away from noise may be less a luxury than a need.",
        "Saturn in the fifth invites patience with creative projects: steady practice over years may matter more than early recognition.",
      ],
      money: [
        "The chart describes attitudes rather than amounts: a Taurus Moon values security and quality, while the twelfth-house emphasis can mean spending on others, learning or travel.",
        "Saturn's current position from the Moon is traditionally associated with slow, steady accumulation. This is not financial advice; it simply suggests patience and planning suit this period.",
      ],
    },
  };
}

const SYNTHESIS: SynthesisPart = {
  agreements: [
    "All three perspectives highlight the exalted Moon: emotional steadiness and care are central strengths.",
    "Each reading sees the current Jupiter period as constructive, especially for learning and trusted relationships.",
    "The twelfth-house emphasis consistently points to reflection, study and work behind the scenes.",
  ],
  differences: [
    "The North Indian reading emphasises the Leo Lagna and house placements, while the Tamil and Kannada readings centre on the Moon, Rohini and calendar markers.",
    "Traditional views of Sade Sati range from cautious to constructive; this report reads it as a season of maturing rather than hardship.",
  ],
  combinedSummary: [
    "Taken together, this is a chart of warm visibility balanced by a deep private life. The Leo Lagna and Mercury give presence and expression; the exalted Moon gives stability and care that others can rely on.",
    "The present Jupiter period supports steady growth, and the Mercury sub-period until 2027 favours skills and communication. From mid-2027, Saturn's next Sade Sati invites simplification and patient foundation-building.",
    "Practically, the chart suggests protecting quiet time, investing in learning, and letting reputation build step by step. As with any astrological reading, these are possibilities to reflect on, not certainties.",
  ],
  contextResponse:
    "The sample customer mentioned a Moon sign of Mithuna (Gemini). Our calculation places the Moon in Vrishabha (Taurus) using the Lahiri ayanamsa - the tropical (Western) Moon for this birth is in Gemini, which likely explains the difference. This report uses the calculated sidereal value.",
  questionAnswers: [
    {
      questionNumber: 1,
      answer: [
        "The Mercury sub-period until August 2027 favours communication, skills and planning, while the exalted tenth-house Moon supports trust and reputation. Together they suggest growth through visible competence rather than sudden leaps.",
        "A practical focus could be one clear skill or credential and consistent, reliable delivery. Saturn's current position from the Moon supports patient progress.",
      ],
    },
    {
      questionNumber: 2,
      answer: [
        "Venus and Jupiter together in Cancer describe care and loyalty, but in the twelfth house much of it may stay unspoken. Steadiness may come from saying what you need rather than only giving.",
        "The Taurus Moon values routine and reliability; small, regular rituals of time together may do more than grand gestures.",
      ],
    },
    {
      questionNumber: 3,
      answer: [
        "Sade Sati from mid-2027 is best approached as a long period of consolidation. It often brings more responsibility and a push to simplify, which can be constructive when met with planning.",
        "There is nothing you need to buy or perform to get through it. Keeping commitments realistic, looking after rest, and building durable skills are sensible ways to work with this transit.",
      ],
    },
  ],
};

let cached: ReportDocument | null = null;

export async function buildSampleReport(): Promise<ReportDocument> {
  if (cached) return cached;
  const r = resolveLocalTime(SAMPLE_BIRTH.tz, SAMPLE_BIRTH.date, SAMPLE_BIRTH.time);
  if (r.kind !== "unique") throw new Error("Sample birth time must be unambiguous");
  const day = localDayRange(SAMPLE_BIRTH.tz, SAMPLE_BIRTH.date);
  const result = await builtInCalculationProvider.calculate({
    tradition: "indian",
    timeCertainty: "exact",
    birthUtcMs: r.instant.utcMs,
    windowMinutes: null,
    dayStartUtcMs: day.startMs,
    dayEndUtcMs: day.endMs,
    localDate: SAMPLE_BIRTH.date,
    latitude: SAMPLE_BIRTH.lat,
    longitude: SAMPLE_BIRTH.lon,
    timeZoneId: SAMPLE_BIRTH.tz,
    referenceDate: new Date(`${REFERENCE_DATE}T00:00:00Z`),
  });
  const chart = result.chart;
  const periods = selectPeriods(chart, REFERENCE_DATE);
  const context = { knownMoonSign: "gemini" as const, knownNakshatra: null, knownPada: null, knownAscendant: null, otherKnownDetails: null, additionalContext: null };
  const discrepancies = findDiscrepancies(chart, context);
  const input = buildInterpretationInput({
    chart,
    language: "en",
    referenceDate: REFERENCE_DATE,
    birthDate: "1990-08-15",
    periods,
    discrepancies,
    knownDetails: { moonSign: "gemini", nakshatra: null, pada: null, ascendant: null, other: null },
    notes: null,
    questions: QUESTIONS,
  });
  // The sample is held to the same validation as real AI output.
  const core = validatePart("core", CORE, input);
  const timeline = validatePart("timeline", timelineFor(periods), input);
  const synthesis = validatePart("synthesis", SYNTHESIS, input);
  cached = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: "sample",
    isDemo: false,
    orderReference: "RA-SAMPLE00",
    language: "en",
    tradition: "indian",
    preparedOn: REFERENCE_DATE,
    subject: {
      name: "Meera (fictional sample)",
      birthDate: "1990-08-15",
      birthTime: "06:30",
      timeCertainty: "exact",
      windowMinutes: null,
      placeLabel: "Chennai, Tamil Nadu, India",
      latitude: SAMPLE_BIRTH.lat,
      longitude: SAMPLE_BIRTH.lon,
      timezoneId: SAMPLE_BIRTH.tz,
      utcOffsetLabel: "UTC+05:30",
    },
    calculation: { provider: result.provider, providerVersion: result.providerVersion, calculationVersion: result.calculationVersion },
    chart,
    interpretation: { core, timeline, synthesis, promptVersion: `${PROMPT_VERSION} (sample text written by hand)`, provider: "sample", model: "handwritten" },
    periods,
    discrepancies,
    customerNotes: null,
    questions: QUESTIONS,
  };
  return cached;
}
