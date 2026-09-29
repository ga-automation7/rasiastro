import type { TraditionCode } from "@/config/languages";
import type { NakshatraKey, SignKey } from "@/domain/astrology/constants";
import type { BirthDetailsInput } from "@/domain/order-input";

/**
 * One person's details as held by the order forms (personal: one person; compatibility:
 * two). Kept in memory only - never written to localStorage or sessionStorage.
 */
export interface PlaceOption {
  id: string;
  name: string;
  region: string | null;
  country: string;
  timezoneId: string;
}

export interface BirthFieldsState {
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
}

export interface KnownState {
  moonSign: SignKey | "";
  nakshatra: NakshatraKey | "";
  pada: string;
  ascendant: SignKey | "";
  otherDetails: string;
}

export const EMPTY_BIRTH: BirthFieldsState = {
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
};

export const EMPTY_KNOWN: KnownState = { moonSign: "", nakshatra: "", pada: "", ascendant: "", otherDetails: "" };

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function isoBirthDate(s: Pick<BirthFieldsState, "day" | "month" | "year">): string | null {
  if (!s.day || !s.month || !s.year) return null;
  return `${s.year}-${s.month.padStart(2, "0")}-${s.day.padStart(2, "0")}`;
}

/** 12-hour picker values to an unambiguous 24-hour "HH:MM". */
export function time24(s: Pick<BirthFieldsState, "hour12" | "minute" | "meridiem">): string | null {
  if (!s.hour12 || !s.minute || !s.meridiem) return null;
  let hour = Number(s.hour12) % 12;
  if (s.meridiem === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${s.minute.padStart(2, "0")}`;
}

export function from24(value: string | null): Pick<BirthFieldsState, "hour12" | "minute" | "meridiem"> {
  if (!value) return { hour12: "", minute: "", meridiem: "" };
  const [h, m] = value.split(":").map(Number) as [number, number];
  return { hour12: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, "0"), meridiem: h < 12 ? "AM" : "PM" };
}

export function placeLabel(p: PlaceOption): string {
  return [p.name, p.region, p.country].filter(Boolean).join(", ");
}

export function dateLabel(s: Pick<BirthFieldsState, "day" | "month" | "year">): string {
  return s.day && s.month && s.year ? `${s.day} ${MONTHS[Number(s.month) - 1]} ${s.year}` : "-";
}

export function timeLabel(s: BirthFieldsState): string {
  if (s.timeCertainty === "unknown") return "Not known";
  if (!s.timeCertainty) return "-";
  const t = time24(s);
  return `${s.hour12}:${s.minute} ${s.meridiem}${t ? ` (${t})` : ""}${s.timeCertainty === "approximate" ? ` · approximate, ± ${s.timeWindowMinutes} min` : " · exact"}`;
}

/** The birth part of an order request, exactly as the server schema expects it. */
export function birthInput(s: BirthFieldsState): Omit<BirthDetailsInput, "timeCertainty"> & { timeCertainty: BirthDetailsInput["timeCertainty"] } {
  return {
    subjectName: s.subjectName,
    birthDate: isoBirthDate(s) ?? "",
    timeCertainty: s.timeCertainty ?? ("" as "exact"),
    birthTime: s.timeCertainty === "unknown" ? null : time24(s),
    timeWindowMinutes: s.timeCertainty === "approximate" ? s.timeWindowMinutes : null,
    dstChoice: s.dstChoice,
    placeId: s.place?.id ?? "",
  };
}

export function knownInput(k: KnownState, tradition: TraditionCode | null) {
  return {
    moonSign: k.moonSign || null,
    nakshatra: tradition === "indian" ? k.nakshatra || null : null,
    pada: tradition === "indian" && k.pada ? Number(k.pada) : null,
    ascendant: k.ascendant || null,
    otherDetails: k.otherDetails.trim() || null,
  };
}

/** Quick checks for immediate feedback (the server re-validates everything). */
export function birthErrors(s: BirthFieldsState, prefix: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (s.subjectName.trim().length < 2) e[`${prefix}.subjectName`] = "Please enter the full name.";
  if (!s.day || !s.month || !s.year) e[`${prefix}.birthDate`] = "Please choose the day, month and year of birth.";
  if (!s.timeCertainty) e[`${prefix}.timeCertainty`] = "Please tell us how sure you are of the birth time.";
  if (s.timeCertainty && s.timeCertainty !== "unknown" && (!s.hour12 || !s.minute || !s.meridiem)) e[`${prefix}.birthTime`] = "Please choose the hour, minute and AM or PM.";
  if (s.timeCertainty === "approximate" && !s.timeWindowMinutes) e[`${prefix}.timeWindowMinutes`] = "Please choose how far off the time could be.";
  if (!s.place) e[`${prefix}.placeId`] = "Please search for the birthplace and choose it from the list.";
  return e;
}

export function hasKnownDetails(k: KnownState): boolean {
  return Boolean(k.moonSign || k.nakshatra || k.ascendant || k.otherDetails);
}
