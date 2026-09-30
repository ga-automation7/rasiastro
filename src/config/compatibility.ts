/**
 * Compatibility connection categories. Each ₹39 order includes exactly one.
 *
 * The category changes the ANALYSIS (which chart factors are examined, see
 * src/server/astrology/compatibility.ts) and the report sections, not only the title.
 * Romantic language is used only where `romantic` is true. No category assumes gender,
 * orientation or spouse roles: the two people are always simply the two people.
 */
export const COMPATIBILITY_CATEGORY_KEYS = [
  "relationship",
  "marriage",
  "friendship",
  "career_teamwork",
  "business_partnership",
  "family",
] as const;
export type CompatibilityCategory = (typeof COMPATIBILITY_CATEGORY_KEYS)[number];

export interface CategoryCopy {
  key: CompatibilityCategory;
  label: string;
  description: string;
  romantic: boolean;
  /** Placeholders shown in the shared-context form for this category. */
  examples: { howKnown: string; knownDuration: string; hopes: string; sharedCircumstances: string };
  /** Optional starter ideas the customer can tap to add to "what you hope to understand". */
  prompts: string[];
  /** Heading of the category-specific section in the report. */
  reportFocusTitle: string;
}

export const COMPATIBILITY_CATEGORIES: readonly CategoryCopy[] = [
  {
    key: "relationship",
    label: "Relationship",
    description: "Romantic connection and emotional expression.",
    romantic: true,
    examples: {
      howKnown: "e.g. We met through friends and have been together for a while",
      knownDuration: "e.g. About two years",
      hopes: "e.g. How we each show affection and handle disagreements",
      sharedCircumstances: "e.g. We are thinking about living together",
    },
    prompts: ["How we express affection differently", "What helps us feel close after a disagreement", "How we balance time together and apart"],
    reportFocusTitle: "Your romantic connection",
  },
  {
    key: "marriage",
    label: "Marriage",
    description: "Shared expectations, responsibilities, and daily life.",
    romantic: true,
    examples: {
      howKnown: "e.g. We are married / We are planning to marry",
      knownDuration: "e.g. Married for five years",
      hopes: "e.g. How we share responsibilities and make decisions together",
      sharedCircumstances: "e.g. A new home, or caring for family members",
    },
    prompts: ["How we share responsibilities at home", "How we make big decisions together", "What steadies us in stressful periods"],
    reportFocusTitle: "Marriage and shared life",
  },
  {
    key: "friendship",
    label: "Friendship",
    description: "Support, social rhythm, and boundaries.",
    romantic: false,
    examples: {
      howKnown: "e.g. We were classmates at college",
      knownDuration: "e.g. Over ten years",
      hopes: "e.g. How we support each other and keep the friendship easy",
      sharedCircumstances: "e.g. We now live in different cities",
    },
    prompts: ["How we support each other", "How we handle different social rhythms", "Where our boundaries differ"],
    reportFocusTitle: "Your friendship",
  },
  {
    key: "career_teamwork",
    label: "Career & teamwork",
    description: "Collaboration between two people.",
    romantic: false,
    examples: {
      howKnown: "e.g. We work in the same team",
      knownDuration: "e.g. Eight months",
      hopes: "e.g. How we divide work and give each other feedback",
      sharedCircumstances: "e.g. We are starting a big project together",
    },
    prompts: ["How we divide work", "How we give and receive feedback", "How we handle deadlines and pressure"],
    reportFocusTitle: "Working together",
  },
  {
    key: "business_partnership",
    label: "Business partnership",
    description: "Roles, shared direction, and how decisions are made.",
    romantic: false,
    examples: {
      howKnown: "e.g. We started a small business together",
      knownDuration: "e.g. Partners for three years",
      hopes: "e.g. How we split roles and make decisions",
      sharedCircumstances: "e.g. We are deciding whether to expand",
    },
    prompts: ["How we split roles", "How we make decisions together", "How we handle risk differently"],
    reportFocusTitle: "Partnership in business",
  },
  {
    key: "family",
    label: "Family",
    description: "Communication, expectations, and support.",
    romantic: false,
    examples: {
      howKnown: "e.g. We are siblings / parent and adult child",
      knownDuration: "e.g. All our lives",
      hopes: "e.g. How we can communicate more easily",
      sharedCircumstances: "e.g. Looking after an elderly parent together",
    },
    prompts: ["How we communicate", "Where our expectations differ", "How we support each other"],
    reportFocusTitle: "Family connection",
  },
];

export function getCategory(key: CompatibilityCategory): CategoryCopy {
  return COMPATIBILITY_CATEGORIES.find((c) => c.key === key)!;
}

export function isCompatibilityCategory(value: unknown): value is CompatibilityCategory {
  return typeof value === "string" && (COMPATIBILITY_CATEGORY_KEYS as readonly string[]).includes(value);
}

/**
 * What each category examines. Indian: which traditional factors, in reading order
 * (Yoni and Nadi are traditional marriage-matching factors, so only romantic
 * categories include them). Western: which planets' cross-chart contacts are
 * emphasised. This drives the calculation, the report sections and the AI brief.
 */
export const CATEGORY_ANALYSIS: Record<
  CompatibilityCategory,
  {
    indianFactors: readonly ("moon_sign_relationship" | "tara" | "gana" | "graha_maitri" | "yoni" | "nadi")[];
    westernFocus: readonly ("sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn")[];
    /** Themes the interpretation must cover, in this order. */
    themes: readonly string[];
  }
> = {
  relationship: {
    indianFactors: ["moon_sign_relationship", "graha_maitri", "gana", "tara", "yoni", "nadi"],
    westernFocus: ["venus", "mars", "moon", "sun"],
    themes: ["emotional expression and affection", "closeness and independence", "handling disagreement and repair"],
  },
  marriage: {
    indianFactors: ["moon_sign_relationship", "graha_maitri", "gana", "tara", "nadi", "yoni"],
    westernFocus: ["moon", "venus", "saturn", "sun", "jupiter"],
    themes: ["shared expectations of daily life", "sharing responsibilities and decisions", "support through stressful periods"],
  },
  friendship: {
    indianFactors: ["graha_maitri", "moon_sign_relationship", "gana", "tara"],
    westernFocus: ["moon", "mercury", "jupiter", "venus"],
    themes: ["mutual support", "social rhythm and shared interests", "boundaries and space"],
  },
  career_teamwork: {
    indianFactors: ["graha_maitri", "tara", "moon_sign_relationship", "gana"],
    westernFocus: ["mercury", "mars", "saturn", "sun"],
    themes: ["dividing work and complementary strengths", "feedback and communication at work", "pace, pressure and deadlines"],
  },
  business_partnership: {
    indianFactors: ["graha_maitri", "moon_sign_relationship", "tara", "gana"],
    westernFocus: ["jupiter", "saturn", "mercury", "mars", "sun"],
    themes: ["roles and shared direction", "making decisions and handling risk", "trust and accountability"],
  },
  family: {
    indianFactors: ["moon_sign_relationship", "graha_maitri", "gana", "tara"],
    westernFocus: ["moon", "sun", "saturn", "mercury"],
    themes: ["everyday communication", "differing expectations", "ways of offering support"],
  },
};

/** Limits for the shared-context fields (characters). */
export const SHARED_CONTEXT_LIMITS = { howKnown: 200, knownDuration: 80, hopes: 600, sharedCircumstances: 600 } as const;
export const PERSON_NOTE_LIMIT = 800;
