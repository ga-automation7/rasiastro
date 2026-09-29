/**
 * THE single source of truth for prices. All amounts are integer paise (INR x 100).
 *
 * Business rules (do not change without the owner's approval):
 * - One report, Indian OR Western tradition: INR 49.
 * - Optional add-on: THREE personalised questions for INR 20 in total (not per question).
 * - Report only = INR 49; report + three questions = INR 69.
 * - The PDF is included. There is no separate download charge.
 *
 * When prices change, bump PRICING_VERSION. Every order stores a snapshot of the
 * package and price it was sold at, so historical orders are never re-priced.
 */
export const PRICING_VERSION = "2026-09-v1";

export const CURRENCY = "INR" as const;

export const PRICING = {
  report: {
    code: "report",
    amountPaise: 4900,
  },
  questionsAddon: {
    code: "questions_bundle_3",
    amountPaise: 2000,
    questionCount: 3,
  },
} as const;

export const QUESTION_MIN_LENGTH = 10;
export const QUESTION_MAX_LENGTH = 300;
