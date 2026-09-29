import type { LanguageCode } from "@/config/languages";
import type { ChartData, ChartResult } from "@/domain/astrology/chart-types";
import type { InterpretationParts } from "../interpretation/schema";
import { REPORT_SCHEMA_VERSION } from "../interpretation/schema";
import type { DiscrepancyItem } from "./discrepancies";
import type { ReportPeriod } from "./periods";

/**
 * The complete, frozen content of one report. Stored once in `reports.content`; the
 * web page and the PDF are both rendered from it, so opening a report never triggers
 * another AI call and the web and PDF versions always match.
 */
export interface ReportDocument {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  kind: "order" | "sample";
  /** True when demo adapters produced any part of this report. */
  isDemo: boolean;
  orderReference: string;
  language: LanguageCode;
  tradition: "indian" | "western";
  preparedOn: string;
  subject: {
    name: string;
    birthDate: string;
    birthTime: string | null;
    timeCertainty: "exact" | "approximate" | "unknown";
    windowMinutes: number | null;
    placeLabel: string;
    latitude: number;
    longitude: number;
    timezoneId: string;
    utcOffsetLabel: string;
  };
  calculation: Pick<ChartResult, "provider" | "providerVersion" | "calculationVersion">;
  chart: ChartData;
  interpretation: InterpretationParts & { promptVersion: string; provider: string; model: string };
  periods: ReportPeriod[];
  discrepancies: DiscrepancyItem[];
  customerNotes: string | null;
  questions: string[];
}

export { REPORT_SCHEMA_VERSION };
