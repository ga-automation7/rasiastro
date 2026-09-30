/**
 * Interpretation perspectives. These are presentation and interpretive emphases over
 * ONE shared calculated chart - not separate calculation systems. The Indian
 * perspectives differ in regional naming, calendar conventions (Tamil solar months;
 * amanta vs purnimanta lunar months) and chart layout (South vs North Indian), which
 * are genuine, documented differences. The Western perspectives differ in method.
 */
export type PerspectiveKey = "tamil" | "kannada" | "north_indian" | "modern_psychological" | "traditional";

export interface Perspective {
  key: PerspectiveKey;
  name: string;
  focus: string;
}

const INDIAN: Perspective[] = [
  {
    key: "tamil",
    name: "Tamil presentation perspective",
    focus:
      "Tamil naming of Rasi, Nakshatram and Lagnam; the South Indian chart layout; the Tamil solar month of birth; emphasis common in Tamil practice on the janma nakshatram and its lord, and on Moon-sign based transits (for example Saturn's transit from the Rasi).",
  },
  {
    key: "kannada",
    name: "Kannada presentation perspective",
    focus:
      "Kannada naming; the amanta lunar calendar used in Karnataka (month ending on the new moon) and the lunar month of birth; emphasis on the Moon's nakshatra, tithi and the Vimshottari periods as commonly read in Karnataka.",
  },
  {
    key: "north_indian",
    // Key kept for stored reports; customers see "Hindi (Janma Kundali)".
    name: "Hindi (Janma Kundali) presentation perspective",
    focus:
      "Hindi naming; the North Indian diamond chart centred on the Lagna, reading life areas by house (bhava) from the Lagna; the purnimanta lunar calendar (month ending on the full moon); emphasis on the Lagna lord and house placements.",
  },
];

const WESTERN: Perspective[] = [
  {
    key: "modern_psychological",
    name: "Modern psychological perspective",
    focus: "Sun, Moon and Rising as core motivations, needs and style; planets as inner drives; aspects as inner dialogues; growth-oriented language.",
  },
  {
    key: "traditional",
    name: "Traditional perspective",
    focus: "Essential dignities (domicile, exaltation, detriment, fall), day/night sect, whole-chart balance and house rulership as used in classical Western astrology.",
  },
];

export function perspectivesFor(tradition: "indian" | "western"): Perspective[] {
  return tradition === "indian" ? INDIAN : WESTERN;
}
