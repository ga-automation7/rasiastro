import { COPY, PRICE } from "./site-copy";

/**
 * Frequently asked questions, as plain text so the same words feed the visible FAQ
 * and its FAQPage structured data (Google requires the two to match). Links are kept
 * separate and shown after the answer. Delivery times come from configuration.
 */
export interface FaqItem {
  q: string;
  a: string;
  link?: { href: string; label: string };
}

export function purchaseFaq(typicalMinutes: number, maxHours: number): FaqItem[] {
  return [
    {
      q: "What do I receive?",
      a: "A personal report built from your calculated birth chart: your chart and planetary positions, what each placement means, your personality and patterns, career, relationships, money and growth, the periods behind and ahead of you, and a closing summary. You read it online and download it as a PDF.",
    },
    {
      q: "How personalised is the report?",
      a: "Everything starts from your own chart, calculated from your date, time and place of birth. The AI writes each section from those calculated positions, in the tradition and language you choose, and takes any notes you add into account. It is not a sun sign horoscope shared with everyone born in the same month.",
    },
    {
      q: "How long does it take?",
      a: `Your report starts preparing as soon as your payment is confirmed, and your order page shows each stage. Most reports are ready in about ${typicalMinutes} minutes, and we aim to deliver every report within ${maxHours} hours. We also email you a private link, so you can close the page.`,
    },
    {
      q: "What if I don't know my exact birth time?",
      a: "Choose \"Not sure\" or \"Approximate\". We calculate only what holds true across the possible times, such as your Rasi and planet signs, and leave out what needs an exact time, such as the Lagna, houses and exact dasha dates. Where something could have changed, the report shows every possibility rather than guessing.",
    },
    {
      q: "Is this generated using AI?",
      a: "Yes. Our calculation engine works out your chart from your birth details, and AI writes the interpretation from that calculated chart. It never calculates or invents planetary positions. Every report is checked automatically for structure, completeness and language; no astrologer reviews it before delivery.",
    },
    {
      q: "Which astrology system is used?",
      a: "You choose. Indian (Vedic) reports use the sidereal zodiac with the Lahiri ayanamsa, whole sign houses from your Lagna and Vimshottari dasha periods. Western reports use the tropical zodiac with Placidus houses (Porphyry at extreme latitudes, where Placidus cannot be calculated).",
    },
    {
      q: "Can I choose my language?",
      a: `Yes. ${COPY.regional.languagesNote} Tradition and language are separate choices, so an Indian report in English or a Western report in Tamil both work. ${COPY.regional.perspectivesNote}`,
    },
    {
      q: "What happens after ordering?",
      a: "You review your details and pay once through our payment partner. Your report is then prepared in the background while your order page shows its progress, and we email you a private link when it is ready. The PDF downloads from your report page. No account is needed, and a lost link can be requested again at any time.",
      link: { href: "/recover", label: "Find my report" },
    },
  ];
}

export const MORE_FAQ: FaqItem[] = [
  {
    q: "What is included in my Jathagam?",
    a: "Your Rasi chart (D1) in both traditional layouts; your Lagna, Rasi, Nakshatra and pada; every planetary placement; your Vimshottari dasha periods and the Saturn and Jupiter transits that matter; and a written interpretation with Tamil, Kannada and Hindi regional perspectives and a closing summary. Divisional charts such as Navamsa (D9) are not included.",
    link: { href: "/indian-astrology-report", label: "About the Indian report" },
  },
  {
    q: "What does compatibility include?",
    a: `Both people's charts, the traditional factors or planetary contacts that matter for the connection you choose, and a written reading on communication, shared strengths, potential friction and the dynamics of your connection, with prompts to discuss together. It costs ${PRICE.compatibility} for the pair, with an online report and PDF. There is no compatibility score, and the report never tells anyone whether to marry, part ways or work together.`,
    link: { href: "/compatibility-report", label: "About the compatibility report" },
  },
  {
    q: "Which regional perspectives are included?",
    a: `${COPY.regional.perspectivesNote} ${COPY.regional.notYet}`,
  },
  {
    q: "What if generation fails?",
    a: "We retry automatically, and a retry never costs you anything. If your report still cannot be completed, your order page will say so and show you how to reach us. We will then complete it or refund you under our Refund and Cancellation policy.",
    link: { href: "/refund-policy", label: "Refund and Cancellation policy" },
  },
  {
    q: "How are my birth details handled?",
    a: "We use them only to prepare and deliver your report. Your name, email, phone number and birthplace are never sent to the AI. Notes you add are shared with it, so it can take them into account. Your report opens only through your private link.",
    link: { href: "/privacy", label: "Privacy Policy" },
  },
];
