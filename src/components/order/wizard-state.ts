import type { LanguageCode, TraditionCode } from "@/config/languages";
import type { NakshatraKey, SignKey } from "@/domain/astrology/constants";
import type { OrderInputRaw } from "@/domain/order-input";

/**
 * In-memory state of the order form. Deliberately NOT persisted to localStorage or
 * sessionStorage: birth details stay in this tab only until the order is created.
 */
export interface PlaceOption {
  id: string;
  name: string;
  region: string | null;
  country: string;
  timezoneId: string;
}

export interface WizardState {
  tradition: TraditionCode | null;
  language: LanguageCode | null;
  subjectName: string;
  day: string;
  month: string;
  year: string;
  timeCertainty: "exact" | "approximate" | "unknown" | null;
  hour12: string;
  minute: string;
  meridiem: "AM" | "PM" | "";
  timeWindowMinutes: number | null;
  dstChoice: "earlier" | "later" | null;
  place: PlaceOption | null;
  known: { moonSign: SignKey | ""; nakshatra: NakshatraKey | ""; pada: string; ascendant: SignKey | ""; otherDetails: string };
  additionalContext: string;
  includeQuestions: boolean;
  questions: [string, string, string];
  email: string;
  phone: string;
  consent: boolean;
}

export const EMPTY_STATE: WizardState = {
  tradition: null,
  language: null,
  subjectName: "",
  day: "",
  month: "",
  year: "",
  timeCertainty: null,
  hour12: "",
  minute: "",
  meridiem: "",
  timeWindowMinutes: null,
  dstChoice: null,
  place: null,
  known: { moonSign: "", nakshatra: "", pada: "", ascendant: "", otherDetails: "" },
  additionalContext: "",
  includeQuestions: false,
  questions: ["", "", ""],
  email: "",
  phone: "",
  consent: false,
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function isoBirthDate(s: WizardState): string | null {
  if (!s.day || !s.month || !s.year) return null;
  return `${s.year}-${s.month.padStart(2, "0")}-${s.day.padStart(2, "0")}`;
}

/** 12-hour picker values to an unambiguous 24-hour "HH:MM". */
export function time24(s: Pick<WizardState, "hour12" | "minute" | "meridiem">): string | null {
  if (!s.hour12 || !s.minute || !s.meridiem) return null;
  let hour = Number(s.hour12) % 12;
  if (s.meridiem === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${s.minute.padStart(2, "0")}`;
}

export function from24(value: string | null): Pick<WizardState, "hour12" | "minute" | "meridiem"> {
  if (!value) return { hour12: "", minute: "", meridiem: "" };
  const [h, m] = value.split(":").map(Number) as [number, number];
  return { hour12: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, "0"), meridiem: h < 12 ? "AM" : "PM" };
}

export function toOrderInput(s: WizardState): OrderInputRaw {
  return {
    tradition: s.tradition ?? ("" as TraditionCode),
    language: s.language ?? ("" as LanguageCode),
    birth: {
      subjectName: s.subjectName,
      birthDate: isoBirthDate(s) ?? "",
      timeCertainty: s.timeCertainty ?? ("" as "exact"),
      birthTime: s.timeCertainty === "unknown" ? null : time24(s),
      timeWindowMinutes: s.timeCertainty === "approximate" ? s.timeWindowMinutes : null,
      dstChoice: s.dstChoice,
      placeId: s.place?.id ?? "",
    },
    known: {
      moonSign: s.known.moonSign || null,
      nakshatra: s.tradition === "indian" ? s.known.nakshatra || null : null,
      pada: s.tradition === "indian" && s.known.pada ? Number(s.known.pada) : null,
      ascendant: s.known.ascendant || null,
      otherDetails: s.known.otherDetails.trim() || null,
    },
    additionalContext: s.additionalContext.trim() || null,
    includeQuestions: s.includeQuestions,
    questions: s.includeQuestions ? [...s.questions] : [],
    email: s.email,
    phone: s.phone,
    consentProcessing: s.consent as true,
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

export function placeLabel(p: PlaceOption): string {
  return [p.name, p.region, p.country].filter(Boolean).join(", ");
}
