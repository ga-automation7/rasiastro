import { z } from "zod";
import { COMPATIBILITY_CATEGORY_KEYS, PERSON_NOTE_LIMIT, SHARED_CONTEXT_LIMITS } from "@/config/compatibility";
import { LANGUAGE_CODES, TRADITION_CODES } from "@/config/languages";
import { BirthDetailsSchema, EmailSchema, KnownChartDetailsSchema, PhoneSchema, optionalText } from "./order-input";

/**
 * Input for a compatibility order: exactly two people, one category, one tradition,
 * one language. Shared with the browser form; the server re-validates. As with personal
 * orders, nothing price-related is accepted from the request (the price is fixed at ₹39).
 */
export const ParticipantInputSchema = z.object({
  birth: BirthDetailsSchema,
  known: KnownChartDetailsSchema,
  /** "Additional information about this person" - one per person, never merged. */
  additionalInfo: optionalText(PERSON_NOTE_LIMIT),
});
export type ParticipantInput = z.output<typeof ParticipantInputSchema>;

export const SharedContextSchema = z.object({
  howKnown: optionalText(SHARED_CONTEXT_LIMITS.howKnown),
  knownDuration: optionalText(SHARED_CONTEXT_LIMITS.knownDuration),
  hopes: optionalText(SHARED_CONTEXT_LIMITS.hopes),
  sharedCircumstances: optionalText(SHARED_CONTEXT_LIMITS.sharedCircumstances),
});
export type SharedContextInput = z.output<typeof SharedContextSchema>;

export const CompatibilityOrderInputSchema = z
  .object({
    category: z.enum(COMPATIBILITY_CATEGORY_KEYS),
    tradition: z.enum(TRADITION_CODES),
    language: z.enum(LANGUAGE_CODES),
    // A tuple, so there can never be one, three or more participants.
    participants: z.tuple([ParticipantInputSchema, ParticipantInputSchema]),
    shared: SharedContextSchema.default({ howKnown: null, knownDuration: null, hopes: null, sharedCircumstances: null }),
    email: EmailSchema,
    phone: PhoneSchema,
    consentProcessing: z.literal(true, { error: "Please agree so we can prepare and deliver your report" }),
    adultConfirmed: z.literal(true, { error: "Please confirm you are 18 or older" }),
    thirdPartyPermission: z.literal(true, { error: "Please confirm you have permission to share the other person's details" }),
  })
  .superRefine((value, ctx) => {
    value.participants.forEach((p, i) => {
      if (value.tradition === "western" && (p.known.nakshatra !== null || p.known.pada !== null)) {
        ctx.addIssue({ code: "custom", path: ["participants", i, "known", "nakshatra"], message: "Nakshatra details apply to Indian reports only" });
      }
    });
  });

export type CompatibilityOrderInputRaw = z.input<typeof CompatibilityOrderInputSchema>;
export type CompatibilityOrderInput = z.output<typeof CompatibilityOrderInputSchema>;
