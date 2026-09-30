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

/**
 * The homepage, top to bottom. "Frontier AI" and "advanced AI" describe the production
 * model tier (see docs/CLAIMS.md); the model and provider are never named here.
 */
export const HOME = {
  hero: {
    eyebrow: "Indian + Western astrology · AI interpreted",
    headline: ["Your birth chart.", "Decoded for you."],
    supporting:
      "Enter your birth details and receive a beautifully structured personal reading combining traditional astrological systems with advanced AI interpretation.",
    trust: ["Traditional astrology", "Precise chart calculation", "Frontier AI interpretation"],
    primary: CTA.personal,
    secondary: CTA.compatibility,
    reassurance: ["No subscription", "Downloadable PDF", "No account required"],
    questions: `Personal report with 3 questions · ${PRICE.personalWithQuestions}`,
    badge: "Traditional astrology. Interpreted with frontier AI.",
  },
  engine: {
    eyebrow: "The interpretation engine",
    headline: ["Ancient systems.", "Modern intelligence."],
    body: [
      "Your chart begins with your birth data: date, time and place. Planetary positions and astrological calculations form the foundation.",
      "Rasi Astro then uses advanced AI to study the relationships, patterns and traditional interpretations within your chart, and transforms them into a structured personal reading you can actually understand.",
    ],
    badge: ["Tradition", "Computation", "Frontier AI"],
    steps: [
      { n: "01", title: "Calculate", body: "Your birth details are converted into the astronomical and astrological positions used by the selected system." },
      { n: "02", title: "Interpret", body: "Traditional rules, planetary relationships and chart patterns are analysed together instead of as isolated horoscope statements." },
      { n: "03", title: "Compose", body: "Advanced AI turns the analysis into a structured, readable and personalised report." },
    ],
    poweredBy: "Powered by advanced frontier AI",
    guardrail: "The AI interprets your calculated chart. It never invents planetary positions.",
  },
  receive: {
    eyebrow: "See what you receive",
    headline: ["Not a horoscope.", "A report about you."],
    supporting: "Your reading is organised into a beautifully designed PDF you can save, revisit and keep.",
    cta: `See your report · ${PRICE.personal}`,
    note: "Generated specifically from your birth details.",
    sampleNote: "Sample pages for a fictional person. The chart is genuinely calculated; the reading text is illustrative.",
  },
  includes: {
    eyebrow: `What ${PRICE.personal} includes`,
    headline: "More than a daily horoscope.",
    cards: [
      { glyph: "chart", title: "Your chart", body: "Birth chart calculations based on your date, time and place of birth." },
      { glyph: "nakshatra", title: "Your Nakshatra", body: "Understand the lunar constellation traditionally associated with your birth." },
      { glyph: "lagna", title: "Your Rasi & Lagna", body: "See the major foundations used in Indian astrological interpretation." },
      { glyph: "patterns", title: "Personality & patterns", body: "A structured interpretation of recurring strengths, tendencies and themes." },
      { glyph: "career", title: "Career & direction", body: "Explore traditional astrological perspectives related to work, ambition and decision making." },
      { glyph: "relationships", title: "Relationships", body: "Understand chart themes traditionally associated with connection, communication and partnership." },
      { glyph: "periods", title: "Life periods", body: "Explore significant planetary periods and how astrology traditionally interprets their themes." },
      { glyph: "summary", title: "Personal summary", body: "A final synthesis designed to make the entire reading easier to understand." },
    ],
    note: "Nakshatra, Rasi and Lagna belong to Indian reports. A Western report covers your Sun, Moon and Rising signs, aspects and houses instead.",
  },
  pricing: {
    eyebrow: "One payment",
    headline: "Your complete personal reading.",
    points: ["No subscription.", "No account required.", "Your PDF is yours to keep."],
    cta: `Generate my report · ${PRICE.personal}`,
    upsellQuestion: "Want to ask something specific?",
    upsell: `Add 3 personal questions for ${PRICE.questions}.`,
    total: PRICE.personalWithQuestions,
    upsellCta: `Add my questions · ${PRICE.personalWithQuestions}`,
    footnote: "One tradition per purchase, Indian or Western. Questions can be added to personal reports only.",
  },
  compatibility: {
    eyebrow: "Compatibility",
    headline: ["Two charts.", "One deeper comparison."],
    body: "Compare two birth charts across relationship, marriage, friendship, family, business or professional compatibility.",
    label: "Compatibility report",
    responsible: "Designed to explore astrological patterns, not to make important life decisions for you.",
  },
  languages: {
    eyebrow: "Six report languages",
    headline: "Astrology should speak your language.",
    body: "Explore your reading in the language that feels most natural to you.",
    note: "Every report, Indian or Western, can be written in any of these languages. Indian reports also include Tamil, Kannada and Hindi (Janma Kundali) regional perspectives.",
  },
  traditions: {
    eyebrow: "Two traditions",
    center: "Your birth data",
    centerNote: "Choose the system that resonates with you.",
    indian: { title: "Indian astrology", body: "Explore traditional chart interpretation built around concepts such as Rasi, Nakshatra, Lagna and planetary periods." },
    western: { title: "Western astrology", body: "Explore your natal chart through planetary placements, houses, aspects and Western astrological interpretation." },
  },
  transparency: {
    eyebrow: "Built with transparency",
    points: [
      { title: "Real calculations", body: "Chart positions are calculated from the birth information you provide." },
      { title: "AI interpretation", body: "AI helps transform complex astrological information into structured, human readable reports." },
      { title: "Your privacy", body: "Your personal information is used to deliver your report, as described in our privacy policy." },
      { title: "No subscription", body: "Pay for the report you want. No recurring membership." },
    ],
  },
  recovery: {
    title: "Lost your link? Your report is still yours.",
    body: "Enter the email address you ordered with and we will send fresh private links to your reports. No account or password needed.",
    cta: "Find my report",
  },
} as const;

export const COPY = {
  meta: {
    title: "Rasi Astro · Your birth chart, decoded for you",
    description: `Personal birth chart reports (${PRICE.personal}) and compatibility reports for two (${PRICE.compatibility}), in Indian or Western astrology. Calculated with precision, interpreted by AI, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. PDF included. No account needed.`,
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
      { title: "Your chart and its foundations", body: "Every calculated position, explained in plain language: what it is, and why it matters to you." },
      { title: "Patterns to reflect on", body: "The themes that recur across your chart, offered as ideas to sit with, never as verdicts." },
      { title: "Career, relationships and growth", body: "What your chart suggests about your work, the people close to you, the way you grow, and your relationship with money." },
      { title: "Looking back and looking ahead", body: "Past periods you may recognise, and the periods now unfolding, framed as possibilities to prepare for. Never as certainties." },
      { title: "A clear summary to return to", body: "What matters most, gathered in one place and written for you to revisit." },
    ],
    addOn: {
      title: "Make it more personal.",
      price: `Add three questions for ${PRICE.questions}.`,
      body: "Ask about the themes you most want explored. Each question receives its own answer, grounded in your chart.",
      note: "Your answers are written into your report. This is not a live consultation.",
    },
  },
  indian: {
    eyebrow: "Indian astrology",
    headline: ["Your Jathagam.", "Rooted in tradition. Made personal."],
    supporting: "Your Indian birth chart, explained with care. From your Rasi and Nakshatra to every placement and period your birth details can support.",
    detail: "The Indian report is your Jathagam, also called your Janma Kundali: the birth chart itself, and a written interpretation of it.",
    includes: [
      "Your Rasi chart (D1), drawn in both traditional layouts: signs fixed in place, and houses counted from your Lagna",
      "Lagna (Ascendant), Rasi (Moon sign), Nakshatra (birth star) and pada",
      "Every planetary placement, with its sign, degree, house and dignity",
      "Your Vimshottari dasha periods, and the Saturn and Jupiter transits that matter",
      "Your tithi, weekday, and the Tamil and lunar months of your birth",
    ],
    timeNote:
      "Some details need a reliable birth time, such as the Lagna, the houses and exact dasha dates. When your time is approximate or unknown, they are limited or left out, and your report says so.",
  },
  western: {
    eyebrow: "Western astrology",
    headline: ["Your natal chart.", "A different lens on you."],
    supporting:
      "Explore how your planets and signs speak to one another, and your houses where your birth time allows, in an interpretation written around your chart alone.",
    includes: [
      "Your Sun and Moon signs, and your Rising sign when your birth time is known",
      "Every planetary position, and the aspects between them",
      "House placements when your birth time is precise enough",
      "Your balance of elements and modalities, and whether yours is a day or night chart",
      "Two readings of one chart: modern psychological and traditional",
    ],
  },
  regional: {
    eyebrow: "Six report languages",
    headline: ["Familiar traditions.", "In words that feel like home."],
    supporting: "Read your Indian chart with familiar terms and regional context, in the language you choose.",
    languagesNote: "Every report can be written in Tamil, English, Hindi, Telugu, Kannada or Malayalam, in either tradition.",
    perspectivesNote:
      "Every Indian report also includes three regional perspectives: Tamil, Kannada and Hindi (Janma Kundali). Each reads the same calculated chart through its own region's terminology, calendar and emphasis.",
    notYet: "Dedicated Telugu and Malayalam perspectives are not included yet, though reports in those languages are written entirely in your language.",
    method: "Language, layout and regional presentation change how your chart is described. The calculation never changes.",
  },
  compatibility: {
    eyebrow: `Compatibility · ${PRICE.compatibility} for two`,
    headline: ["Two charts.", "A connection worth understanding."],
    supporting: "See how you communicate, where you complement each other, and what may need more understanding. In love, friendship, family or work.",
    price: `Two people. One connection report. ${PRICE.compatibility}.`,
    line: "Two people · One connection category · PDF included",
    how: "Enter both people's birth details. Add a note about each person, and shared context if you wish.",
    outputs: ["Communication", "Shared strengths", "Potential friction", "The dynamics of your connection", "Prompts to discuss together"],
    limits: "No compatibility scores or percentages. The report never tells you whether to marry, part ways, hire each other or start a business.",
  },
  technology: {
    headline: ["Calculated with care.", "Interpreted with context."],
    body: "Our calculation engine builds your chart from the birth details you provide. Our AI then turns that chart into a structured interpretation, shaped by your tradition, your language and any notes you add.",
    notes: "Your notes help us understand what matters to you. They remain what you told us, never discoveries credited to the stars.",
    points: [
      { title: "The chart is calculated, never guessed", body: "Every position comes from astronomical calculation. The AI interprets it. It never invents it." },
      { title: "Uncertainty is shown, not hidden", body: "If your birth time leaves something open, your report says so and shows each possibility." },
      { title: "Checked before you see it", body: "Every interpretation is checked automatically for structure, completeness and language before it becomes part of your report." },
    ],
  },
  report: {
    headline: "A report worth returning to.",
    supporting: "Your chart, its interpretation and your key takeaways, brought together in one personal report to read online or keep as a PDF.",
    features: [
      { title: "A branded cover", body: "Your name, your report and your order reference." },
      { title: "Readable chart diagrams", body: "Indian charts in both traditional layouts. Compatibility charts side by side." },
      { title: "A clear structure", body: "From foundations to periods to summary, in a steady, readable order." },
      { title: "A personal summary", body: "Your main themes, gathered at the end." },
      { title: "Your questions, answered", body: "Each question you add, in a section of its own." },
    ],
  },
  pricing: {
    headline: "Simple prices. Paid once.",
    supporting: "One payment. Online report and PDF included. No account, no subscription.",
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
    footnote: "One tradition per purchase, Indian or Western. Questions can be added to personal reports only.",
  },
  disclaimer:
    "Astrology is an interpretive tradition, not scientifically validated prediction. Use your report for reflection, not as a substitute for professional advice.",
} as const;
