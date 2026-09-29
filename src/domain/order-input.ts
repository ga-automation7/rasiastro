import { z } from "zod";
import { LANGUAGE_CODES, TRADITION_CODES } from "@/config/languages";
import { PRICING, QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "@/config/pricing";
import { NAKSHATRA_KEYS, SIGN_KEYS } from "./astrology/constants";
import { parseIsoDate, parseTime24 } from "./birth-time";

/**
 * Customer input for one report order. Used by the browser form for instant feedback
 * AND re-validated on the server, which is authoritative. Prices are never part of
 * this input: the server derives the price from `includeQuestions`.
 */
export const TIME_WINDOW_OPTIONS = [15, 30, 60, 120, 180] as const;
export const EARLIEST_BIRTH_DATE = "1900-01-01";
export const CONSENT_VERSION = "2026-10-v2";
/**
 * Age policy: orders may only be placed by adults, and only about adults. Reports about
 * children would need verifiable guardian consent, which this release does not build.
 */
export const MIN_AGE_YEARS = 18;

/** True when someone born on isoDate is at least `years` old today (UTC calendar). */
export function isAtLeastAge(isoDate: string, years: number, today: Date = new Date()): boolean {
  const date = parseIsoDate(isoDate);
  if (!date) return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()));
  return Date.UTC(date.year, date.month - 1, date.day) <= cutoff.getTime();
}

const noControlChars = (value: string) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);

export const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .refine(noControlChars, "Contains unsupported characters");

export const optionalText = (max: number) =>
  z
    .union([cleanText(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const KnownChartDetailsSchema = z.object({
  moonSign: z.enum(SIGN_KEYS).nullable().default(null),
  nakshatra: z.enum(NAKSHATRA_KEYS).nullable().default(null),
  pada: z.number().int().min(1).max(4).nullable().default(null),
  ascendant: z.enum(SIGN_KEYS).nullable().default(null),
  otherDetails: optionalText(500),
});
export type KnownChartDetails = z.infer<typeof KnownChartDetailsSchema>;

/** Normalises an Indian 10-digit or international (+country) mobile number. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, "");
  if (/^[6-9]\d{9}$/.test(compact)) return compact;
  const indian = /^(?:\+91|0091|91)([6-9]\d{9})$/.exec(compact);
  if (indian) return indian[1]!;
  if (/^0[6-9]\d{9}$/.test(compact)) return compact.slice(1);
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const BirthDetailsSchema = z
  .object({
    subjectName: cleanText(100).min(2, "Please enter the full name"),
    birthDate: z
      .string()
      .refine((v) => parseIsoDate(v) !== null, "Please enter a valid date")
      .refine((v) => v >= EARLIEST_BIRTH_DATE, "Birth dates before 1900 are not supported")
      // One day of slack covers customers ahead of UTC (e.g. IST just after midnight).
      .refine((v) => v <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), "The birth date cannot be in the future")
      .refine((v) => isAtLeastAge(v, MIN_AGE_YEARS), "Reports are available for adults (18 or older) only"),
    timeCertainty: z.enum(["exact", "approximate", "unknown"]),
    birthTime: z.string().nullable().default(null),
    timeWindowMinutes: z
      .number()
      .refine((v) => (TIME_WINDOW_OPTIONS as readonly number[]).includes(v), "Choose a time range")
      .nullable()
      .default(null),
    /** Only needed when clocks went back and the local time happened twice. */
    dstChoice: z.enum(["earlier", "later"]).nullable().default(null),
    placeId: z.string().min(3).max(80),
  })
  .superRefine((value, ctx) => {
    if (value.timeCertainty === "unknown") {
      if (value.birthTime !== null) ctx.addIssue({ code: "custom", path: ["birthTime"], message: "Birth time must be empty when it is unknown" });
    } else if (!value.birthTime || !parseTime24(value.birthTime)) {
      ctx.addIssue({ code: "custom", path: ["birthTime"], message: "Please enter the birth time (24-hour HH:MM)" });
    }
    if (value.timeCertainty === "approximate" && value.timeWindowMinutes === null) {
      ctx.addIssue({ code: "custom", path: ["timeWindowMinutes"], message: "Please tell us how approximate the time is" });
    }
    if (value.timeCertainty !== "approximate" && value.timeWindowMinutes !== null) {
      ctx.addIssue({ code: "custom", path: ["timeWindowMinutes"], message: "Only used for approximate times" });
    }
  });
export type BirthDetailsInput = z.infer<typeof BirthDetailsSchema>;

export const QuestionSchema = cleanText(QUESTION_MAX_LENGTH)
  .min(QUESTION_MIN_LENGTH, `Please write at least ${QUESTION_MIN_LENGTH} characters`)
  .refine((v) => /\p{L}/u.test(v), "Please write a question");

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address").max(254));
export const PhoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, "Please enter a valid mobile number (10 digits, or + country code)");

export const OrderInputSchema = z
  .object({
    tradition: z.enum(TRADITION_CODES),
    language: z.enum(LANGUAGE_CODES),
    birth: BirthDetailsSchema,
    known: KnownChartDetailsSchema,
    additionalContext: optionalText(1000),
    includeQuestions: z.boolean(),
    questions: z.array(z.string()).max(PRICING.questionsAddon.questionCount),
    email: EmailSchema,
    phone: PhoneSchema,
    consentProcessing: z.literal(true, { error: "Please agree so we can prepare and deliver your report" }),
    adultConfirmed: z.literal(true, { error: "Please confirm you are 18 or older" }),
  })
  .superRefine((value, ctx) => {
    if (value.tradition === "western" && (value.known.nakshatra !== null || value.known.pada !== null)) {
      ctx.addIssue({ code: "custom", path: ["known", "nakshatra"], message: "Nakshatra details apply to Indian reports only" });
    }
    if (value.includeQuestions) {
      if (value.questions.length !== PRICING.questionsAddon.questionCount) {
        ctx.addIssue({ code: "custom", path: ["questions"], message: "Please write all three questions, or remove the question add-on" });
      }
      value.questions.forEach((q, i) => {
        const result = QuestionSchema.safeParse(q);
        if (!result.success) ctx.addIssue({ code: "custom", path: ["questions", i], message: result.error.issues[0]?.message ?? "Invalid question" });
      });
    } else if (value.questions.some((q) => q.trim() !== "")) {
      // Questions are only answered when the add-on is purchased.
      ctx.addIssue({ code: "custom", path: ["questions"], message: "Questions require the ₹20 question add-on" });
    }
  })
  .transform((value) => ({
    ...value,
    questions: value.includeQuestions ? value.questions.map((q) => q.trim()) : [],
  }));

export type OrderInputRaw = z.input<typeof OrderInputSchema>;
export type OrderInput = z.output<typeof OrderInputSchema>;

/** Field-path keyed messages for the form. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
