import type { ChartData, Fact } from "@/domain/astrology/chart-types";
import type { NakshatraKey, SignKey } from "@/domain/astrology/constants";
import type { OrderContextInput } from "../orders/repository";

/**
 * Compares customer-supplied chart details with calculated results. Customer values
 * are unverified context: they never override calculations, but a mismatch is shown
 * clearly and respectfully in the report.
 */
export type DiscrepancyField = "moon_sign" | "nakshatra" | "pada" | "ascendant";
export type Verdict = "match" | "mismatch" | "possible" | "unverifiable";

export interface DiscrepancyItem {
  field: DiscrepancyField;
  customerValue: string;
  calculatedValue: string | null;
  candidates: string[];
  verdict: Verdict;
}

function compare<T extends string | number>(field: DiscrepancyField, customer: T | null, fact: Fact<T> | null): DiscrepancyItem | null {
  if (customer === null || customer === undefined || !fact) return null;
  const base = { field, customerValue: String(customer) };
  if (fact.status === "omitted") return { ...base, calculatedValue: null, candidates: [], verdict: "unverifiable" };
  if (fact.status === "known") {
    return { ...base, calculatedValue: String(fact.value), candidates: [], verdict: fact.value === customer ? "match" : "mismatch" };
  }
  const candidates = fact.candidates.map(String);
  return {
    ...base,
    calculatedValue: fact.atStatedTime === null ? null : String(fact.atStatedTime),
    candidates,
    verdict: candidates.includes(String(customer)) ? "possible" : "mismatch",
  };
}

export function findDiscrepancies(chart: ChartData, context: OrderContextInput | null): DiscrepancyItem[] {
  if (!context) return [];
  const items: (DiscrepancyItem | null)[] = [];
  if (chart.kind === "vedic") {
    items.push(compare<SignKey>("moon_sign", context.knownMoonSign, chart.moonSign));
    items.push(compare<NakshatraKey>("nakshatra", context.knownNakshatra, chart.moonNakshatra));
    items.push(compare<number>("pada", context.knownPada, chart.moonPada));
    const lagnaSign: Fact<SignKey> =
      chart.lagna.status === "known"
        ? { status: "known", value: chart.lagna.value.sign }
        : chart.lagna.status === "uncertain"
          ? { status: "uncertain", candidates: chart.lagna.candidates.map((c) => c.sign), atStatedTime: chart.lagna.atStatedTime?.sign ?? null }
          : chart.lagna;
    items.push(compare<SignKey>("ascendant", context.knownAscendant, lagnaSign));
  } else {
    const moon = chart.bodies.find((b) => b.key === "moon")!;
    items.push(compare<SignKey>("moon_sign", context.knownMoonSign, moon.sign));
    const asc: Fact<SignKey> =
      chart.ascendant.status === "known"
        ? { status: "known", value: chart.ascendant.value.sign }
        : chart.ascendant.status === "uncertain"
          ? { status: "uncertain", candidates: chart.ascendant.candidates.map((c) => c.sign), atStatedTime: chart.ascendant.atStatedTime?.sign ?? null }
          : chart.ascendant;
    items.push(compare<SignKey>("ascendant", context.knownAscendant, asc));
  }
  return items.filter((i): i is DiscrepancyItem => i !== null);
}
