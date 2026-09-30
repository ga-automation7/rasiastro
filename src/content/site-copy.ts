import { PRICING } from "@/config/pricing";
import { formatInr } from "@/domain/pricing";

/**
 * Customer-facing marketing copy for the website, in one typed place.
 *
 * Every concrete claim here maps to something the product generates - see
 * docs/CLAIMS.md before adding one. Prices always come from src/config/pricing.ts.
 * Never name the AI model or provider in marketing copy, never imply human review,
 * and never promise outcomes or scores.
 */
export const PRICE = {
  personal: formatInr(PRICING.report.amountPaise),
  questions: formatInr(PRICING.questionsAddon.amountPaise),
  personalWithQuestions: formatInr(PRICING.report.amountPaise + PRICING.questionsAddon.amountPaise),
  compatibility: formatInr(PRICING.compatibility.amountPaise),
} as const;

export const CTA = {
  personal: `Explore my chart · ${PRICE.personal}`,
  compatibility: `Explore our connection · ${PRICE.compatibility}`,
} as const;

export const COPY = {
  meta: {
    title: "Rasi Astro · The sky at your birth, the story it holds",
    description: `Personal birth-chart reports (${PRICE.personal}) and two-person compatibility reports (${PRICE.compatibility}) in Indian or Western astrology, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. Calculated charts, AI-written interpretation, PDF included, no account needed.`,
  },
  campaign: ["Centuries of tradition.", "Calculated by machines.", "Interpreted for you."],
  hero: {
    headline: ["The sky at your birth.", "The story it holds."],
    supporting:
      "Discover who you are, the chapters that may lie ahead, and the people who shape your story. Written for you in Tamil, English, Hindi, Telugu, Kannada or Malayalam.",
    reassurance: "Pay once. Keep the PDF. No account needed.",
  },
  personal: {
    eyebrow: `Personal report · ${PRICE.personal}`,
    headline: ["More than your sign.", "A fuller picture of you."],
    supporting: "Your birth details are the starting point. Your report brings together your chart, its interpretation, and the questions that matter to you.",
    themes: [
      { title: "Your chart and its foundations", body: "Your calculated positions, explained in plain language—what each placement is and why it matters." },
      { title: "Patterns to reflect on", body: "Recurring themes across your chart, offered as ideas to consider rather than verdicts." },
      { title: "Career, relationships and growth", body: "How your chart speaks to work, the people close to you, personal growth and your relationship with money." },
      { title: "Looking back and looking ahead", body: "Past periods you may recognise, and current and coming periods as possibilities to prepare for—never certainties." },
      { title: "A clear summary to return to", body: "The key takeaways in one place, written for you to come back to." },
    ],
    addOn: {
      title: "Make it more personal.",
      price: `Add three questions for ${PRICE.questions}.`,
      body: "Ask about the themes you want your report to explore. Each question gets its own answer, grounded in your chart.",
      note: "Answers are written into your report. The add-on is not a live consultation.",
    },
  },
  indian: {
    eyebrow: "Indian astrology",
    headline: ["Your Jathagam.", "Rooted in tradition. Made personal."],
    supporting:
      "Your Indian birth chart, explained with care—from your Rasi and Nakshatra to the placements and periods supported by your birth details.",
    detail:
      "The Indian report is your Jathagam, or Janma Kundali: the birth chart itself and a written interpretation of it.",
    includes: [
      "Rasi chart (D1), shown as fixed-sign and house-based birth-chart diagrams",
      "Lagna (Ascendant), Rasi (Moon sign), Nakshatra (birth star) and pada",
      "Planetary placements with signs, degrees, houses and dignities",
      "Vimshottari dasha periods and relevant Saturn and Jupiter transits",
      "Tithi, weekday and the Tamil and lunar months of birth",
    ],
    timeNote: "Details that need a reliable birth time—such as the Lagna, houses and exact dasha dates—are limited or left out when the time is approximate or unknown.",
  },
  western: {
    eyebrow: "Western astrology",
    headline: ["Your natal chart.", "A different lens on you."],
    supporting:
      "Explore the relationships between your planets, signs, and supported house placements—with an interpretation written around your chart.",
    includes: [
      "Sun and Moon signs, and your Rising sign with a known birth time",
      "Planetary positions and the aspects between them",
      "House placements when the birth time is exact enough",
      "Element and modality balance, and the day or night character of the chart",
      "Two readings of the same chart: modern psychological and traditional",
    ],
  },
  regional: {
    eyebrow: "Six report languages",
    headline: ["Familiar traditions.", "In words that feel like home."],
    supporting: "Read your Indian chart with familiar terminology and regional context, presented in your chosen language.",
    languagesNote: "Every report can be written in Tamil, English, Hindi, Telugu, Kannada or Malayalam—for either tradition.",
    perspectivesNote:
      "Every Indian report also includes three regional perspectives—Tamil, Kannada and Hindi (Janma Kundali)—reading the same calculated chart with that region's terminology, calendar and emphasis.",
    notYet: "Dedicated Telugu and Malayalam perspectives are not included yet. Reports in those languages are still written entirely in your language.",
    method: "Language, chart layout and regional presentation change how your chart is described. The calculation is the same.",
  },
  compatibility: {
    eyebrow: `Compatibility · ${PRICE.compatibility} for two`,
    headline: ["Two charts.", "A connection worth understanding."],
    supporting: "Explore how you communicate, where you complement each other, and what may take more understanding—in love, friendship, family, or work.",
    price: `Two people. One connection report. ${PRICE.compatibility}.`,
    line: "Two people · One connection category · PDF included",
    how: "Enter both people's birth details. Add separate notes about each person, and shared context if you like.",
    outputs: ["Communication", "Shared strengths", "Potential friction", "Category-specific dynamics", "Prompts to discuss together"],
    limits: "No compatibility scores or percentages. The report does not tell you whether to marry, separate, hire each other or start a business.",
  },
  technology: {
    headline: ["Calculated with care.", "Interpreted with context."],
    body: "Our calculation engine builds the chart from the birth details you provide. Our AI turns supported chart information into a structured interpretation, shaped by your chosen tradition, language, and optional notes.",
    notes: "Your notes help us understand what matters to you. They remain information you shared—not discoveries attributed to the stars.",
    points: [
      { title: "The chart is calculated, not guessed", body: "Positions come from astronomical calculation. The AI interprets them; it never invents them." },
      { title: "Uncertainty is shown, not hidden", body: "If your birth time leaves something open, the report says so and shows the possibilities." },
      { title: "Checked before you see it", body: "Every interpretation is checked automatically for structure, completeness and language before it joins your report." },
    ],
  },
  report: {
    headline: "A report worth returning to.",
    supporting: "Your chart, its interpretation, and your key takeaways—brought together in one personal report to read online or keep as a PDF.",
    features: [
      { title: "A branded cover", body: "Your name, your report and your order reference." },
      { title: "Readable chart diagrams", body: "Indian charts in both diagram styles; compatibility charts side by side." },
      { title: "Clear section hierarchy", body: "From foundations to periods to summary, in a steady order." },
      { title: "A personal summary", body: "The main themes, brought together at the end." },
      { title: "Your questions, answered", body: "Each purchased question in its own section." },
    ],
  },
  pricing: {
    headline: "Simple, one-time prices.",
    supporting: "Pay once. Online report and PDF included. No account and no subscription.",
    plans: [
      { key: "personal", title: "Your personal report", price: PRICE.personal, body: "One person. Your chosen tradition and language. Online report and PDF included.", href: "/start", cta: CTA.personal },
      {
        key: "questions",
        title: "Your report, with your questions",
        price: PRICE.personalWithQuestions,
        body: "Everything in the personal report, plus answers to three questions.",
        href: "/start?questions=1",
        cta: `Add my questions · ${PRICE.personalWithQuestions}`,
      },
      { key: "compatibility", title: "Your connection report", price: PRICE.compatibility, body: "Two people. One selected connection. Online report and PDF included.", href: "/compatibility", cta: CTA.compatibility },
    ],
    footnote: "One tradition per purchase—Indian or Western. The question add-on is available for personal reports only.",
  },
  disclaimer:
    "Astrology is an interpretive tradition, not scientifically validated prediction. Use your report for reflection, not as a substitute for professional advice.",
} as const;
