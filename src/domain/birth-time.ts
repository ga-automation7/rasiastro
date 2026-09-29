/**
 * Converts a local birth date/time at a place into an absolute instant using the
 * IANA time-zone database built into the JavaScript runtime (historical offsets,
 * wartime time and daylight saving included).
 *
 * We never use the browser's time zone and never invent a time: if the local time
 * is ambiguous (clocks went back) the customer must choose; if it did not exist
 * (clocks went forward) we ask them to check it.
 */

export interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface LocalTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

export interface ResolvedInstant {
  utcMs: number;
  offsetSeconds: number;
}

export type LocalTimeResolution =
  | { kind: "unique"; instant: ResolvedInstant }
  | { kind: "overlap"; earlier: ResolvedInstant; later: ResolvedInstant }
  | { kind: "gap" };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Offset (seconds east of UTC) in force in `timeZone` at the given instant. */
export function offsetSecondsAt(timeZone: string, utcMs: number): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const era = parts.find((p) => p.type === "era")?.value;
  let year = get("year");
  if (era === "BC" || era === "B") year = 1 - year;
  const asUtc = Date.UTC(year, get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  // Whole seconds: historical local mean time offsets (e.g. +05:21:10) include seconds.
  const flooredInstant = Math.floor(utcMs / 1000) * 1000;
  return Math.round((asUtc - flooredInstant) / 1000);
}

function localWallClockMs(date: LocalDate, time: LocalTime): number {
  const ms = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0);
  // Date.UTC maps years 0-99 to 1900-1999; our inputs are always >= 1800.
  return ms;
}

export function resolveLocalTime(timeZone: string, date: LocalDate, time: LocalTime): LocalTimeResolution {
  const wall = localWallClockMs(date, time);
  const hour = 3_600_000;
  const candidateOffsets = new Set<number>([
    offsetSecondsAt(timeZone, wall - 30 * hour),
    offsetSecondsAt(timeZone, wall),
    offsetSecondsAt(timeZone, wall + 30 * hour),
  ]);
  const valid: ResolvedInstant[] = [];
  for (const offset of candidateOffsets) {
    const utcMs = wall - offset * 1000;
    if (offsetSecondsAt(timeZone, utcMs) === offset && !valid.some((v) => v.utcMs === utcMs)) {
      valid.push({ utcMs, offsetSeconds: offset });
    }
  }
  valid.sort((a, b) => a.utcMs - b.utcMs);
  if (valid.length === 0) return { kind: "gap" };
  if (valid.length === 1) return { kind: "unique", instant: valid[0]! };
  return { kind: "overlap", earlier: valid[0]!, later: valid[valid.length - 1]! };
}

/**
 * Resolves the time or, for an invalid (skipped) local time, returns null. For an
 * overlap the caller must pass which of the two readings the customer chose.
 */
export function resolveWithChoice(
  timeZone: string,
  date: LocalDate,
  time: LocalTime,
  overlapChoice: "earlier" | "later" | null,
): { instant: ResolvedInstant; resolution: "unique" | "dst_overlap_earlier" | "dst_overlap_later" } | null {
  const result = resolveLocalTime(timeZone, date, time);
  if (result.kind === "gap") return null;
  if (result.kind === "unique") return { instant: result.instant, resolution: "unique" };
  if (!overlapChoice) return null;
  return overlapChoice === "earlier"
    ? { instant: result.earlier, resolution: "dst_overlap_earlier" }
    : { instant: result.later, resolution: "dst_overlap_later" };
}

/** Instant range covering an entire local calendar day (used when the time is unknown). */
export function localDayRange(timeZone: string, date: LocalDate): { startMs: number; endMs: number; noonOffsetSeconds: number } {
  const start = firstValidInstant(timeZone, date, { hour: 0, minute: 0 }, 1);
  const end = firstValidInstant(timeZone, date, { hour: 23, minute: 59 }, -1);
  const noon = resolveLocalTime(timeZone, date, { hour: 12, minute: 0 });
  const noonOffsetSeconds =
    noon.kind === "unique" ? noon.instant.offsetSeconds : noon.kind === "overlap" ? noon.earlier.offsetSeconds : offsetSecondsAt(timeZone, localWallClockMs(date, { hour: 12, minute: 0 }));
  return { startMs: start, endMs: end + 59_000, noonOffsetSeconds };
}

function firstValidInstant(timeZone: string, date: LocalDate, time: LocalTime, stepMinutes: 1 | -1): number {
  // Walk minute by minute past a DST gap at midnight (rare, but real in some zones).
  let t = { ...time };
  for (let i = 0; i < 180; i += 1) {
    const r = resolveLocalTime(timeZone, date, t);
    if (r.kind === "unique") return r.instant.utcMs;
    if (r.kind === "overlap") return stepMinutes === 1 ? r.earlier.utcMs : r.later.utcMs;
    const total = t.hour * 60 + t.minute + stepMinutes;
    t = { hour: Math.floor(total / 60), minute: total % 60 };
  }
  throw new Error(`Could not resolve local day boundary in ${timeZone}`);
}

export function formatUtcOffset(offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(offsetSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${s ? `:${String(s).padStart(2, "0")}` : ""}`;
}

export function parseIsoDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (check.getUTCFullYear() !== date.year || check.getUTCMonth() !== date.month - 1 || check.getUTCDate() !== date.day) {
    return null;
  }
  return date;
}

export function parseTime24(value: string): LocalTime | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** The IANA tz database version compiled into this runtime (for audit trails). */
export function tzDatabaseVersion(): string | null {
  if (typeof process === "undefined" || !process.versions) return null;
  const versions = process.versions as Record<string, string | undefined>;
  return versions.tz ?? null;
}
