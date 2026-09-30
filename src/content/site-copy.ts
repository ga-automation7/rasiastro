import { PRICING } from "@/config/pricing";
import { formatInr } from "@/domain/pricing";

/**
 * Website copy for customers, in one typed place.
 *
 * Every concrete claim here maps to something the product generates (see
 * docs/CLAIMS.md before adding one). Prices always come from src/config/pricing.ts.
 * House style: no dashes or hyphens in customer copy; never name the AI model or
 * provider in marketing; never imply human review; never promise outcomes or scores.
 */
export const PRICE = {
  personal: formatInr(PRICING.report.amountPaise),
  questions: formatInr(PRICING.questionsAddon.amountPaise),
  personalWithQuestions: formatInr(PRICING.report.amountPaise + PRICING.questionsAddon.amountPaise),
  compatibility: formatInr(PRICING.compatibility.amountPaise),
} as const;

export const CTA = {
  personal: `Get my personal report · ${PRICE.personal}`,
  compatibility: `Check compatibility · ${PRICE.compatibility}`,
} as const;

/** How long reports take, from the configured and measured delivery times. */
export function turnaround(typicalMinutes: number, maxHours: number): string {
  return `Your report starts as soon as your payment is confirmed. Most are ready in about ${typicalMinutes} minutes, and we aim to deliver every report within ${maxHours} hours.`;
}

/**
 * The homepage, top to bottom: what it is, how it works, what you learn, a sample,
 * pricing, the questions people ask before buying, compatibility, traditions and
 * languages, trust, and a closing call to action. "Frontier AI" and "advanced AI"
 * describe the production model tier (see docs/CLAIMS.md); the model and provider are
 * never named here.
 */
export const HOME = {
  hero: {
    eyebrow: "Personal astrology reports · Indian and Western",
    headline: ["Your birth chart.", "Decoded for you."],
    supporting:
      "Your exact birth chart, calculated from the moment and place you were born, then interpreted by AI into a clear personal report. Indian (Vedic) or Western astrology, written in your language.",
    trust: ["Precise chart calculation", "Frontier AI interpretation", "Six report languages"],
    primary: CTA.personal,
    secondary: CTA.compatibility,
    reassurance: ["One payment", "Web report and PDF", "No account needed"],
    questions: `Add three questions of your own · ${PRICE.personalWithQuestions} in total`,
  },
  engine: {
    eyebrow: "How it works",
    headline: ["Ancient systems.", "Modern intelligence."],
    body: "Astrology begins with the sky at the moment you were born. Rasi Astro calculates that sky precisely, then uses advanced AI to read your chart through the tradition you choose and write it up as a report you can actually understand.",
    steps: [
      { n: "01", title: "Calculate", body: "Your date, time and place of birth become exact planetary positions, with your birthplace's historical time zone applied." },
      { n: "02", title: "Interpret", body: "Traditional rules, planetary relationships and chart patterns are read together, not as isolated horoscope lines." },
      { n: "03", title: "Compose", body: "Advanced AI writes a structured personal report in your language, checked automatically before it reaches you." },
    ],
    guardrail: "The AI interprets your calculated chart. It never invents planetary positions.",
  },
  learn: {
    eyebrow: "Inside your report",
    headline: "What exactly will I learn?",
    supporting: "Every section is written from your own calculated chart, in the tradition and language you choose.",
    topics: [
      { glyph: "chart", title: "Your chart, calculated", body: "Every planet with its sign, degree and house, and what each position means for you, in plain language." },
      { glyph: "patterns", title: "Personality and patterns", body: "The strengths and tendencies that recur across your chart, offered as ideas to reflect on." },
      { glyph: "career", title: "Career and direction", body: "What your chart suggests about work, ambition and the way you make decisions." },
      { glyph: "relationships", title: "Relationships", body: "Themes of connection, communication and partnership in your chart." },
      { glyph: "growth", title: "Money and growth", body: "Your chart's perspective on money and security, and on the ways you grow." },
      { glyph: "past", title: "Periods behind you", body: "Past planetary periods you may recognise, framed as patterns rather than facts." },
      { glyph: "periods", title: "Periods ahead", body: "The periods now unfolding, each with its opportunities and its challenges." },
      { glyph: "perspectives", title: "Traditions compared", body: "Your chart read from more than one perspective, and where those readings agree or differ." },
      { glyph: "summary", title: "Summary and your questions", body: "Your main themes gathered in one place, with answers to any questions you add." },
    ],
    tabs: { indian: "In an Indian report", western: "In a Western report" },
  },
  sample: {
    eyebrow: "Sample report",
    headline: ["Not a horoscope.", "A report about you."],
    supporting: "Six pages from our sample report. Open any page to look closer.",
    cta: `Get my report · ${PRICE.personal}`,
    sampleNote: "Sample pages for a fictional person. The chart is genuinely calculated; the reading text is illustrative.",
  },
  pricing: {
    eyebrow: "Pricing",
    headline: "Your complete personal reading.",
    included: [
      "Your calculated birth chart and a full written reading",
      "Indian (Vedic) or Western astrology, your choice",
      "Tamil, English, Hindi, Telugu, Kannada or Malayalam",
      "A web report and a PDF to keep",
      "A private link by email. No account, no subscription",
    ],
    cta: `Get my personal report · ${PRICE.personal}`,
    upsellQuestion: "Want to ask something specific?",
    upsell: `Add three personal questions for ${PRICE.questions}. Each one is answered in its own section of your report.`,
    total: PRICE.personalWithQuestions,
    upsellCta: `Add my questions · ${PRICE.personalWithQuestions}`,
    footnote: "One tradition per purchase. Questions can be added to personal reports only.",
    compatibility: `Two people? A compatibility report is ${PRICE.compatibility} for the pair.`,
  },
  compatibility: {
    eyebrow: "Compatibility",
    headline: ["Two charts.", "One deeper comparison."],
    body: "Compare two birth charts for a relationship, marriage, friendship, family, business or working partnership.",
    label: "for two people",
  },
  traditions: {
    eyebrow: "Your tradition, your language",
    headline: ["Two traditions.", "Six languages."],
    supporting: "Choose the astrology you know, and read it in the language that feels like home. Either tradition can be written in any of the six languages.",
    indian: {
      title: "Indian (Vedic) astrology",
      body: "Your Jathagam, or Janma Kundali: Rasi, Nakshatra, Lagna and your Vimshottari dasha periods, on the sidereal zodiac.",
      href: "/indian-astrology-report",
      link: "About the Indian report",
    },
    western: {
      title: "Western astrology",
      body: "Your natal chart: Sun, Moon and Rising signs, planetary aspects and houses, on the tropical zodiac.",
      href: "/western-astrology-report",
      link: "About the Western report",
    },
    languagesNote: "Indian reports also include Tamil, Kannada and Hindi (Janma Kundali) regional perspectives.",
  },
  trust: {
    eyebrow: "Why you can trust it",
    headline: "Transparent by design.",
    points: [
      {
        glyph: "chart",
        title: "Calculated, not guessed",
        body: "Planetary positions come from an astronomical engine, with your birthplace's historical time zone applied. When your birth time leaves something open, the report says so.",
      },
      { glyph: "spark", title: "Honest about AI", body: "AI writes your reading from the calculated chart, and every report is checked automatically. No astrologer reviews it, and we say so plainly." },
      {
        glyph: "lock",
        title: "Private by default",
        body: "Your name, email, phone and birthplace are never sent to the AI. Your report opens only through your private link, and we use no advertising or analytics trackers.",
      },
      { glyph: "shield", title: "Secure payment", body: "You pay once, through our payment partner. We never see your card details or your UPI PIN." },
    ],
  },
  recovery: {
    title: "Lost your link? Your report is still yours.",
    body: "Enter the email address you ordered with and we will send fresh private links to your reports. No account or password needed.",
    cta: "Find my report",
  },
  final: {
    eyebrow: "Begin",
    headline: ["Begin with the moment", "you were born."],
    supporting: "Enter your birth details and receive a personal report to read online and keep as a PDF.",
  },
} as const;

export const COPY = {
  meta: {
    title: "Personal astrology reports from your birth chart · Rasi Astro",
    description: `Personal astrology reports from your exact birth chart. Indian (Vedic) or Western, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. Web report and PDF from ${PRICE.personal}.`,
  },
  campaign: ["Centuries of tradition.", "Calculated by machines.", "Interpreted for you."],
  personal: {
    addOn: {
      title: "Make it more personal.",
      price: `Add three questions for ${PRICE.questions}.`,
      body: "Ask about the themes you most want explored. Each question receives its own answer, grounded in your chart.",
      note: "Your answers are written into your report. This is not a live consultation.",
    },
  },
  indian: {
    detail: "The Indian report is your Jathagam, also called your Janma Kundali: the birth chart itself, and a written interpretation of it.",
    includes: [
      "Your Rasi chart (D1), drawn in both traditional layouts: signs fixed in place, and houses counted from your Lagna",
      "Lagna (Ascendant), Rasi (Moon sign), Nakshatra (birth star) and pada",
      "Every planetary placement, with its sign, degree, house and dignity",
      "Your Vimshottari dasha periods, and the Saturn and Jupiter transits that matter",
      "Your tithi, weekday, and the Tamil and lunar months of your birth",
      "Tamil, Kannada and Hindi (Janma Kundali) regional perspectives on the same chart",
    ],
    timeNote:
      "Some details need a reliable birth time, such as the Lagna, the houses and exact dasha dates. When your time is approximate or unknown, they are limited or left out, and your report says so.",
  },
  western: {
    includes: [
      "Your Sun and Moon signs, and your Rising sign when your birth time is known",
      "Every planetary position, and the aspects between them",
      "House placements when your birth time is precise enough",
      "Your balance of elements and modalities, and whether yours is a day or night chart",
      "Two readings of one chart: modern psychological and traditional",
    ],
    timeNote: "The Rising sign, Midheaven and houses need a reliable birth time. When your time is approximate or unknown, they are limited or left out, and your report says so.",
  },
  regional: {
    languagesNote: "Every report can be written in Tamil, English, Hindi, Telugu, Kannada or Malayalam, in either tradition.",
    perspectivesNote:
      "Every Indian report also includes three regional perspectives: Tamil, Kannada and Hindi (Janma Kundali). Each reads the same calculated chart through its own region's terminology, calendar and emphasis.",
    notYet: "Dedicated Telugu and Malayalam perspectives are not included yet, though reports in those languages are written entirely in your language.",
    method: "Language, layout and regional presentation change how your chart is described. The calculation never changes.",
  },
  compatibility: {
    how: "Enter both people's birth details. Add a note about each person, and shared context if you wish.",
    line: "Two people · One connection category · PDF included",
    outputs: ["Communication", "Shared strengths", "Potential friction", "The dynamics of your connection", "Prompts to discuss together"],
    limits: "No compatibility scores or percentages. The report never tells you whether to marry, part ways, hire each other or start a business. It explores astrological patterns; the decisions stay yours.",
  },
  disclaimer:
    "Astrology is an interpretive tradition, not scientifically validated prediction. Use your report for reflection, not as a substitute for professional advice.",
} as const;
