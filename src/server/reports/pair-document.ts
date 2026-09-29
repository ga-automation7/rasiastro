import type { CompatibilityCategory } from "@/config/compatibility";
import type { LanguageCode } from "@/config/languages";
import type { ChartData, ChartResult } from "@/domain/astrology/chart-types";
import type { PairAnalysis } from "@/domain/astrology/compatibility-types";
import type { PairInterpretationParts } from "../interpretation/pair-schema";
import type { PAIR_REPORT_SCHEMA_VERSION } from "../interpretation/pair-schema";
import type { DiscrepancyItem } from "./discrepancies";
import type { ReportDocument } from "./document";

/**
 * The complete, frozen content of one compatibility report. Stored once in
 * `reports.content` (like ReportDocument); the web page and the PDF are both rendered
 * from it, so reopening a report never triggers another AI call.
 */
export interface PairPerson {
  /** Stable participant identity (birth_details.participant_id). */
  participantId: string;
  subject: ReportDocument["subject"];
  chart: ChartData;
  discrepancies: DiscrepancyItem[];
  /** "Additional information about this person", exactly as the customer typed it. */
  notes: string | null;
}

export interface PairReportDocument {
  schemaVersion: typeof PAIR_REPORT_SCHEMA_VERSION;
  product: "compatibility";
  kind: "order" | "sample";
  isDemo: boolean;
  orderReference: string;
  language: LanguageCode;
  tradition: "indian" | "western";
  category: CompatibilityCategory;
  preparedOn: string;
  people: [PairPerson, PairPerson];
  shared: { howKnown: string | null; knownDuration: string | null; hopes: string | null; sharedCircumstances: string | null };
  calculation: Pick<ChartResult, "provider" | "providerVersion" | "calculationVersion"> & { pairCalculationVersion: string };
  analysis: PairAnalysis;
  interpretation: PairInterpretationParts & { promptVersion: string; provider: string; model: string };
}

/** Either kind of stored report. Documents saved before compatibility existed have no `product`. */
export type AnyReportDocument = ReportDocument | PairReportDocument;

export function isPairDocument(doc: AnyReportDocument): doc is PairReportDocument {
  return (doc as PairReportDocument).product === "compatibility";
}
