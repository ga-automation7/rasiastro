import { parseIsoDate } from "@/domain/birth-time";
import { EARLIEST_BIRTH_DATE, MIN_AGE_YEARS, TIME_WINDOW_OPTIONS, isAtLeastAge } from "@/domain/order-input";
import { time24, timeLabel, type BirthFieldsState } from "./person";

/**
 * Pure helpers behind the personal "birth details" step. They only change how details
 * are entered: the values produced are the same fields the order API has always taken
 * (day/month/year to YYYY-MM-DD, a 24-hour time, one of TIME_WINDOW_OPTIONS).
 */

/** Reads a typed or pasted date: 07/10/2003, 7-10-2003, 07.10.2003, 07102003 or 2003-10-07. Day first, as in India. */
export function parseDateText(text: string): { day: string; month: string; year: string } | null {
  const t = text.trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (iso) return { day: iso[3]!.padStart(2, "0"), month: iso[2]!.padStart(2, "0"), year: iso[1]! };
  const dmy = /^(\d{1,2})\s*[-/. ]\s*(\d{1,2})\s*[-/. ]\s*(\d{4})$/.exec(t);
  if (dmy) return { day: dmy[1]!.padStart(2, "0"), month: dmy[2]!.padStart(2, "0"), year: dmy[3]! };
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (compact) return { day: compact[1]!, month: compact[2]!, year: compact[3]! };
  return null;
}

export type DobStatus = "empty" | "incomplete" | "invalid" | "future" | "too_early" | "under_age" | "ok";

export const DOB_MESSAGES: Record<Exclude<DobStatus, "ok" | "empty" | "incomplete">, string> = {
  invalid: "Enter a valid date.",
  future: "The date of birth cannot be in the future.",
  too_early: "Birth dates before 1900 are not supported.",
  under_age: "Reports are for adults (18 or older) only.",
};

/** The same checks as the server (order-input.ts), so the form never accepts what the API rejects. */
export function dobStatus(day: string, month: string, year: string, today: Date = new Date()): DobStatus {
  if (!day && !month && !year) return "empty";
  if (!day || !month || year.length !== 4) return "incomplete";
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !parseIsoDate(iso)) return "invalid";
  if (iso < EARLIEST_BIRTH_DATE) return "too_early";
  if (iso > today.toISOString().slice(0, 10)) return "future";
  if (!isAtLeastAge(iso, MIN_AGE_YEARS, today)) return "under_age";
  return "ok";
}

/**
 * Times of day for an approximate birth time. Each is a four-hour block written as
 * its centre time with a window of plus or minus two hours: exactly the existing
 * "approximate" representation, so the calculation checks the whole block.
 */
export const APPROX_BLOCKS = [
  { key: "late_night", label: "Late night", range: "12 AM to 4 AM", center: "02:00" },
  { key: "early_morning", label: "Early morning", range: "4 AM to 8 AM", center: "06:00" },
  { key: "morning", label: "Morning", range: "8 AM to 12 PM", center: "10:00" },
  { key: "afternoon", label: "Afternoon", range: "12 PM to 4 PM", center: "14:00" },
  { key: "evening", label: "Evening", range: "4 PM to 8 PM", center: "18:00" },
  { key: "night", label: "Night", range: "8 PM to 12 AM", center: "22:00" },
] as const;
export const APPROX_BLOCK_WINDOW = 120;

export type ApproxBlockKey = (typeof APPROX_BLOCKS)[number]["key"];

function to12(value24: string): Pick<BirthFieldsState, "hour12" | "minute" | "meridiem"> {
  const [h, m] = value24.split(":").map(Number) as [number, number];
  return { hour12: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, "0"), meridiem: h < 12 ? "AM" : "PM" };
}

export function approxBlockPatch(key: ApproxBlockKey): Partial<BirthFieldsState> {
  const block = APPROX_BLOCKS.find((b) => b.key === key)!;
  return { ...to12(block.center), timeWindowMinutes: APPROX_BLOCK_WINDOW, dstChoice: null };
}

/** The block the current values describe, if they are exactly one of the blocks. */
export function selectedApproxBlock(s: BirthFieldsState): ApproxBlockKey | null {
  if (s.timeCertainty !== "approximate" || s.timeWindowMinutes !== APPROX_BLOCK_WINDOW) return null;
  const t = time24(s);
  return APPROX_BLOCKS.find((b) => b.center === t)?.key ?? null;
}

export const PRECISE_WINDOWS = TIME_WINDOW_OPTIONS;

/** The review line for the time: a chosen time of day reads as that, not as its centre time. */
export function personalTimeLabel(s: BirthFieldsState): string {
  const key = selectedApproxBlock(s);
  const block = key ? APPROX_BLOCKS.find((b) => b.key === key) : undefined;
  return block ? `${block.label}, ${block.range} · approximate` : timeLabel(s);
}

/**
 * Changing how sure you are of the time starts the time afresh: a time typed as
 * "exact" must never travel silently into "approximate" (or the other way round), and
 * "unknown" carries no time at all.
 */
export function certaintyPatch(next: NonNullable<BirthFieldsState["timeCertainty"]>): Partial<BirthFieldsState> {
  return { timeCertainty: next, hour12: "", minute: "", meridiem: "", timeWindowMinutes: null, dstChoice: null };
}

export function validHour(hour12: string): boolean {
  return /^\d{1,2}$/.test(hour12) && Number(hour12) >= 1 && Number(hour12) <= 12;
}

export function validMinute(minute: string): boolean {
  return /^\d{1,2}$/.test(minute) && Number(minute) <= 59;
}

export function timeComplete(s: Pick<BirthFieldsState, "hour12" | "minute" | "meridiem">): boolean {
  return validHour(s.hour12) && validMinute(s.minute) && s.minute.length > 0 && Boolean(s.meridiem);
}

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.length >= 2 ? first : "";
}

/** Friendly, field-level checks for the personal step (the server re-validates everything). */
export function personalBirthErrors(s: BirthFieldsState, today: Date = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  if (s.subjectName.trim().length < 2) e["birth.subjectName"] = "Please enter their name.";
  const dob = dobStatus(s.day, s.month, s.year, today);
  if (dob === "empty" || dob === "incomplete") e["birth.birthDate"] = "Enter the date of birth as DD / MM / YYYY.";
  else if (dob !== "ok") e["birth.birthDate"] = DOB_MESSAGES[dob];
  if (!s.timeCertainty) e["birth.timeCertainty"] = "Choose the option that fits best.";
  if (s.timeCertainty === "exact" && !timeComplete(s)) e["birth.birthTime"] = "Enter the birth time, for example 6:30 AM.";
  if (s.timeCertainty === "approximate") {
    if (!s.timeWindowMinutes || !timeComplete(s)) e["birth.timeWindowMinutes"] = "Choose the closest option.";
  }
  if (!s.place) e["birth.placeId"] = "Choose a location from the suggestions.";
  return e;
}
