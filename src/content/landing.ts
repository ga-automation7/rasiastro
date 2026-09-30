import { COMPATIBILITY_CATEGORIES } from "@/config/compatibility";
import type { FaqItem } from "./faq";
import { COPY, PRICE } from "./site-copy";

/**
 * Copy for the public product pages. Each page explains one product in depth: what is
 * calculated, what the reading covers, how birth time matters, and what it costs.
 * Every statement maps to the calculation or report code (see docs/CLAIMS.md).
 * House style: no dashes or hyphens; never name the AI model or provider.
 */
export interface LandingSection {
  heading: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
}

export interface LandingCopy {
  path: string;
  crumb: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: readonly string[];
  lead: string;
  cta: { href: string; label: string };
  priceNote: string;
  sections: readonly LandingSection[];
  faq: readonly FaqItem[];
  related: readonly { href: string; label: string }[];
}

export const INDIAN_REPORT: LandingCopy = {
  path: "/indian-astrology-report",
  crumb: "Indian astrology report",
  metaTitle: "Indian (Vedic) astrology report: your Jathagam, explained",
  metaDescription: `Your Jathagam or Janma Kundali, calculated precisely: Rasi, Nakshatra, Lagna, planets and Vimshottari dasha, with a written reading in Tamil, English, Hindi, Telugu, Kannada or Malayalam. ${PRICE.personal}, web report and PDF.`,
  eyebrow: "Indian (Vedic) astrology",
  headline: ["Your Jathagam,", "calculated and explained."],
  lead: "A personal Indian astrology report built from your exact birth chart: your Rasi, Nakshatra and Lagna, every planet, your dasha periods, and a written reading of what they suggest. In the language you choose.",
  cta: { href: "/start?tradition=indian", label: `Get my Indian report · ${PRICE.personal}` },
  priceNote: `${PRICE.personal} for the report, or ${PRICE.personalWithQuestions} with three questions of your own. Web report and PDF included.`,
  sections: [
    {
      heading: "What is calculated",
      paragraphs: [
        "Your chart is calculated from your date, time and place of birth, with your birthplace's historical time zone applied. Indian reports use the sidereal zodiac with the Lahiri (Chitrapaksha) ayanamsa, whole sign houses counted from your Lagna, and the Vimshottari dasha system.",
      ],
      list: COPY.indian.includes,
    },
    {
      heading: "What your reading covers",
      paragraphs: [
        "The reading is written from those calculated positions. It explains what each placement means, the patterns that recur across your chart, and what the chart suggests about career, relationships, money and personal growth. It looks back at past periods you may recognise and ahead at the periods now unfolding, each with its opportunities and challenges, and ends with a summary to return to.",
        "Past periods are framed as patterns you may recognise, and future periods as possibilities to prepare for. Nothing in the report is presented as a certainty.",
      ],
    },
    {
      heading: "Tamil, Kannada and Hindi perspectives",
      paragraphs: [COPY.regional.perspectivesNote, COPY.regional.method, COPY.regional.notYet],
    },
    {
      heading: "When your birth time is not exact",
      paragraphs: [
        COPY.indian.timeNote,
        "If the Moon could have changed Rasi or Nakshatra during the possible birth window, the report shows each possibility instead of choosing one. We never assume a time such as noon.",
      ],
    },
    {
      heading: "Any language you prefer",
      paragraphs: [`${COPY.regional.languagesNote} An Indian report in English, or in Malayalam, is written entirely in that language.`],
    },
  ],
  faq: [
    {
      q: "Is this the same as a Jathagam or Janma Kundali?",
      a: "Yes. The Indian report is your Jathagam, also called your Janma Kundali: the birth chart itself, drawn in both the fixed sign and the house based layouts, with the planetary positions and a written interpretation of them.",
    },
    {
      q: "Which ayanamsa and house system do you use?",
      a: "The Lahiri (Chitrapaksha) ayanamsa on the sidereal zodiac, with whole sign houses counted from your Lagna. Dasha periods follow the Vimshottari system.",
    },
    {
      q: "Is the Navamsa (D9) chart included?",
      a: "No. The report covers the Rasi chart (D1). Divisional charts such as the Navamsa are not included today.",
    },
    {
      q: "Does a human astrologer write or review the report?",
      a: "No. The chart is calculated by our engine and the reading is written by AI from that calculated chart, then checked automatically for structure, completeness and language. No astrologer reviews it before delivery.",
    },
  ],
  related: [
    { href: "/western-astrology-report", label: "The Western astrology report" },
    { href: "/compatibility-report", label: "Compatibility for two people" },
    { href: "/#report", label: "See sample report pages" },
    { href: "/about", label: "How Rasi Astro works" },
  ],
};

export const WESTERN_REPORT: LandingCopy = {
  path: "/western-astrology-report",
  crumb: "Western astrology report",
  metaTitle: "Western astrology birth chart report: your natal chart, explained",
  metaDescription: `Your natal chart calculated precisely: Sun, Moon and Rising signs, planets, aspects and houses, with modern and traditional readings, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. ${PRICE.personal}, web report and PDF.`,
  eyebrow: "Western astrology",
  headline: ["Your natal chart,", "read two ways."],
  lead: "A personal Western astrology report built from your exact birth chart: your Sun, Moon and Rising signs, every planet and the aspects between them, your houses, and a written reading from both a modern and a traditional perspective.",
  cta: { href: "/start?tradition=western", label: `Get my Western report · ${PRICE.personal}` },
  priceNote: `${PRICE.personal} for the report, or ${PRICE.personalWithQuestions} with three questions of your own. Web report and PDF included.`,
  sections: [
    {
      heading: "What is calculated",
      paragraphs: [
        "Your chart is calculated from your date, time and place of birth, with your birthplace's historical time zone applied. Western reports use the tropical zodiac and Placidus houses. At extreme northern or southern latitudes, where Placidus cannot be calculated, Porphyry houses are used and the report says so.",
      ],
      list: COPY.western.includes,
    },
    {
      heading: "What your reading covers",
      paragraphs: [
        "The reading explains what each placement and major aspect means for you, the patterns that recur across your chart, and what the chart suggests about career, relationships, money and personal growth. It looks back at past periods and ahead at the transits now unfolding, each with its opportunities and challenges, and closes with a summary.",
        "Two perspectives read the same tropical chart: one with a modern psychological approach, one with traditional techniques. The report shows where they agree and where they differ.",
      ],
    },
    {
      heading: "When your birth time is not exact",
      paragraphs: [
        COPY.western.timeNote,
        "Planet signs and most aspects hold for the whole day, so they are still calculated. If the Moon changed sign during the possible birth window, both possibilities are shown. We never assume a time such as noon.",
      ],
    },
    {
      heading: "Any language you prefer",
      paragraphs: [`${COPY.regional.languagesNote} A Western report in Tamil or Hindi is written entirely in that language.`],
    },
  ],
  faq: [
    {
      q: "Is this a sun sign horoscope?",
      a: "No. A sun sign horoscope is shared by everyone born in the same month. This report is calculated from your own date, time and place of birth, and covers every planet, the aspects between them and, when your birth time allows, your Rising sign and houses.",
    },
    {
      q: "Which zodiac and house system do you use?",
      a: "The tropical zodiac with Placidus houses, the standard in European and American astrology. Porphyry houses are used only at extreme latitudes where Placidus cannot be calculated.",
    },
    {
      q: "Is there a chart wheel in the report?",
      a: "Personal Western reports present your chart as clear tables of planets, signs, degrees, houses and aspects. A wheel diagram is included in Western compatibility reports.",
    },
    {
      q: "Does a human astrologer write or review the report?",
      a: "No. The chart is calculated by our engine and the reading is written by AI from that calculated chart, then checked automatically for structure, completeness and language. No astrologer reviews it before delivery.",
    },
  ],
  related: [
    { href: "/indian-astrology-report", label: "The Indian (Vedic) astrology report" },
    { href: "/compatibility-report", label: "Compatibility for two people" },
    { href: "/#report", label: "See sample report pages" },
    { href: "/about", label: "How Rasi Astro works" },
  ],
};

export const COMPATIBILITY_REPORT: LandingCopy = {
  path: "/compatibility-report",
  crumb: "Compatibility report",
  metaTitle: "Astrology compatibility report for two people",
  metaDescription: `Compare two birth charts for a relationship, marriage, friendship, family, business or working partnership. Indian or Western astrology, no scores, written in your language. ${PRICE.compatibility} for the pair.`,
  eyebrow: "Compatibility",
  headline: ["Two charts,", "one connection understood."],
  lead: "A compatibility report that calculates both birth charts and compares them for the connection you choose: how you communicate, where you complement each other, and what may need more understanding.",
  cta: { href: "/compatibility", label: `Check compatibility · ${PRICE.compatibility}` },
  priceNote: `${PRICE.compatibility} for the pair: both charts, one connection category, web report and PDF.`,
  sections: [
    {
      heading: "Choose the connection",
      paragraphs: ["The category changes which chart factors are examined and which sections the report contains, not only its title. Each order covers one category."],
      list: COMPATIBILITY_CATEGORIES.map((c) => `${c.label}: ${c.description}`),
    },
    {
      heading: "What is compared",
      paragraphs: [
        "Indian reports compare traditional factors such as the Moon sign relationship, Tara, Gana and Graha Maitri. Yoni and Nadi, which belong to marriage matching, appear only for relationship and marriage.",
        "Western reports compare planetary contacts between the two charts (synastry) and where each person's planets fall in the other's houses, when birth times allow.",
      ],
    },
    {
      heading: "What the report covers",
      list: COPY.compatibility.outputs,
    },
    {
      heading: "What it never does",
      paragraphs: [
        COPY.compatibility.limits,
        "The report makes no assumptions about gender or roles: the two people are simply the two people you describe.",
      ],
    },
  ],
  faq: [
    {
      q: "Is there a compatibility score or percentage?",
      a: "No. Scores reduce a connection to a number and a traditional points total assumes fixed roles, so the report shows the individual factors and explains them instead.",
    },
    {
      q: "Do both people need to know their birth time?",
      a: "No. Each person's time can be exact, approximate or unknown. Anything that depends on a time that is not known is limited or left out for that person, and the report says so.",
    },
    {
      q: "Can I choose Indian or Western astrology?",
      a: "Yes. Choose one tradition and one report language per order. Any tradition can be written in Tamil, English, Hindi, Telugu, Kannada or Malayalam.",
    },
  ],
  related: [
    { href: "/indian-astrology-report", label: "The Indian (Vedic) astrology report" },
    { href: "/western-astrology-report", label: "The Western astrology report" },
    { href: "/about", label: "How Rasi Astro works" },
    { href: "/#faq", label: "Questions, answered" },
  ],
};
