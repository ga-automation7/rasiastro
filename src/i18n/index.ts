import type { LanguageCode } from "@/config/languages";
import { en } from "./en";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { ta } from "./ta";
import { te } from "./te";
import type { ReportDictionary } from "./types";

export type { ReportDictionary } from "./types";

const DICTIONARIES: Record<LanguageCode, ReportDictionary> = { en, ta, hi, te, kn, ml };

export function getDictionary(code: LanguageCode): ReportDictionary {
  return DICTIONARIES[code];
}

/** Locale-aware date such as "15 August 1990" / "15 ஆகஸ்ட், 1990". Dates are calendar dates, shown in UTC. */
export function formatDate(isoDate: string, dictionary: ReportDictionary): string {
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  return new Intl.DateTimeFormat(dictionary.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
