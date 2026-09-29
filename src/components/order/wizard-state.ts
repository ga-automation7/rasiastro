import type { LanguageCode, TraditionCode } from "@/config/languages";
import type { OrderInputRaw } from "@/domain/order-input";
import { EMPTY_BIRTH, EMPTY_KNOWN, birthInput, knownInput, type BirthFieldsState, type KnownState } from "./person";

export { MONTHS, from24, isoBirthDate, placeLabel, time24, type PlaceOption } from "./person";

/**
 * In-memory state of the personal order form. Deliberately NOT persisted to
 * localStorage or sessionStorage: birth details stay in this tab only until the order
 * is created.
 */
export interface WizardState extends BirthFieldsState {
  tradition: TraditionCode | null;
  language: LanguageCode | null;
  known: KnownState;
  additionalContext: string;
  includeQuestions: boolean;
  questions: [string, string, string];
  email: string;
  phone: string;
  consent: boolean;
  adult: boolean;
}

export const EMPTY_STATE: WizardState = {
  ...EMPTY_BIRTH,
  tradition: null,
  language: null,
  known: EMPTY_KNOWN,
  additionalContext: "",
  includeQuestions: false,
  questions: ["", "", ""],
  email: "",
  phone: "",
  consent: false,
  adult: false,
};

export function toOrderInput(s: WizardState): OrderInputRaw {
  return {
    tradition: s.tradition ?? ("" as TraditionCode),
    language: s.language ?? ("" as LanguageCode),
    birth: birthInput(s),
    known: knownInput(s.known, s.tradition),
    additionalContext: s.additionalContext.trim() || null,
    includeQuestions: s.includeQuestions,
    questions: s.includeQuestions ? [...s.questions] : [],
    email: s.email,
    phone: s.phone,
    consentProcessing: s.consent as true,
    adultConfirmed: s.adult as true,
  };
}

export type StepId = 1 | 2 | 3 | 4;

/** Which step owns a server field error such as "birth.birthTime". */
export function stepForField(field: string): StepId {
  if (field.startsWith("tradition") || field.startsWith("language")) return 1;
  if (field.startsWith("birth")) return 2;
  if (field.startsWith("known") || field.startsWith("questions") || field.startsWith("additionalContext") || field.startsWith("includeQuestions")) return 3;
  return 4;
}
