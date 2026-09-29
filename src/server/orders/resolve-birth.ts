import {
  formatUtcOffset,
  isValidTimeZone,
  localDayRange,
  parseIsoDate,
  parseTime24,
  resolveLocalTime,
  tzDatabaseVersion,
} from "@/domain/birth-time";
import type { BirthDetailsInput } from "@/domain/order-input";
import { getEnv } from "../config/env";
import type { SqlExecutor } from "../db";
import { validationError } from "../errors";
import { getPlaceById, type Place } from "../places/repository";

export interface ResolvedBirth {
  place: Place;
  birthDate: string;
  birthTime: string | null;
  timeCertainty: BirthDetailsInput["timeCertainty"];
  timeWindowMinutes: number | null;
  /** Null when the time is unknown - we never invent a birth moment. */
  birthUtc: string | null;
  utcOffsetSeconds: number;
  utcOffsetLabel: string;
  offsetResolution: "unique" | "dst_overlap_earlier" | "dst_overlap_later" | "date_only";
  dayStartUtcMs: number;
  dayEndUtcMs: number;
  tzDatabaseVersion: string | null;
}

/** Returned when the customer must choose between two readings of a repeated hour. */
export interface DstOverlapPrompt {
  kind: "dst_overlap";
  earlierOffsetLabel: string;
  laterOffsetLabel: string;
}

export async function resolveBirth(db: SqlExecutor, birth: BirthDetailsInput): Promise<ResolvedBirth | DstOverlapPrompt> {
  const place = await getPlaceById(db, birth.placeId);
  if (!place || (getEnv().APP_MODE === "live" && place.source !== "geonames")) {
    throw validationError("Please search for and confirm the birthplace again.", { "birth.placeId": "Birthplace not found" });
  }
  if (!isValidTimeZone(place.timezoneId)) {
    throw validationError("We could not determine the time zone for this birthplace. Please choose a nearby town.", {
      "birth.placeId": "Time zone unavailable",
    });
  }
  const date = parseIsoDate(birth.birthDate);
  if (!date) throw validationError("Please enter a valid date of birth.", { "birth.birthDate": "Invalid date" });
  const day = localDayRange(place.timezoneId, date);

  const base = {
    place,
    birthDate: birth.birthDate,
    timeCertainty: birth.timeCertainty,
    timeWindowMinutes: birth.timeCertainty === "approximate" ? birth.timeWindowMinutes : null,
    dayStartUtcMs: day.startMs,
    dayEndUtcMs: day.endMs,
    tzDatabaseVersion: tzDatabaseVersion(),
  };

  if (birth.timeCertainty === "unknown") {
    return {
      ...base,
      birthTime: null,
      birthUtc: null,
      utcOffsetSeconds: day.noonOffsetSeconds,
      utcOffsetLabel: formatUtcOffset(day.noonOffsetSeconds),
      offsetResolution: "date_only",
    };
  }

  const time = parseTime24(birth.birthTime ?? "");
  if (!time) throw validationError("Please enter the birth time.", { "birth.birthTime": "Invalid time" });
  const resolution = resolveLocalTime(place.timezoneId, date, time);
  if (resolution.kind === "gap") {
    throw validationError(
      "This local time did not exist at that place on that date, because the clocks were moved forward. Please check the birth time on the certificate.",
      { "birth.birthTime": "Time skipped by a clock change" },
    );
  }
  let instant = resolution.kind === "unique" ? resolution.instant : null;
  let offsetResolution: ResolvedBirth["offsetResolution"] = "unique";
  if (resolution.kind === "overlap") {
    if (!birth.dstChoice) {
      return {
        kind: "dst_overlap",
        earlierOffsetLabel: formatUtcOffset(resolution.earlier.offsetSeconds),
        laterOffsetLabel: formatUtcOffset(resolution.later.offsetSeconds),
      };
    }
    instant = birth.dstChoice === "earlier" ? resolution.earlier : resolution.later;
    offsetResolution = birth.dstChoice === "earlier" ? "dst_overlap_earlier" : "dst_overlap_later";
  }
  return {
    ...base,
    birthTime: `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`,
    birthUtc: new Date(instant!.utcMs).toISOString(),
    utcOffsetSeconds: instant!.offsetSeconds,
    utcOffsetLabel: formatUtcOffset(instant!.offsetSeconds),
    offsetResolution,
  };
}

export function isDstPrompt(value: ResolvedBirth | DstOverlapPrompt): value is DstOverlapPrompt {
  return "kind" in value && value.kind === "dst_overlap";
}
