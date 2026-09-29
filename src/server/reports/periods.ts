import type { ChartData, DashaPeriod, TransitPeriod } from "@/domain/astrology/chart-types";
import type { VedicGraha } from "@/domain/astrology/constants";

/**
 * Time periods the report discusses under "Looking back" and "Looking ahead". They
 * come from calculation (dasha periods, slow-planet transits), never from the AI.
 * Each has a stable id so AI paragraphs can be matched back to their dates.
 */
export interface ReportPeriod {
  id: string;
  when: "past" | "current" | "upcoming";
  kind: "mahadasha" | "antardasha" | "sade_sati" | "jupiter_from_moon" | "saturn_from_moon" | "transit";
  start: string;
  end: string;
  lord?: VedicGraha;
  parentLord?: VedicGraha;
  transit?: TransitPeriod;
  house?: number;
}

function classify(start: string, end: string, today: string): ReportPeriod["when"] {
  if (end <= today) return "past";
  if (start > today) return "upcoming";
  return "current";
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function selectPeriods(chart: ChartData, referenceDate: string): ReportPeriod[] {
  return chart.kind === "vedic" ? vedicPeriods(chart, referenceDate) : westernPeriods(chart, referenceDate);
}

function vedicPeriods(chart: Extract<ChartData, { kind: "vedic" }>, today: string): ReportPeriod[] {
  const periods: ReportPeriod[] = [];
  const timeline = chart.dasha.status === "known" ? chart.dasha.value : chart.dasha.status === "uncertain" ? chart.dasha.atStatedTime : null;
  if (timeline) {
    const mahas = timeline.mahadashas;
    const currentIndex = mahas.findIndex((m) => m.start <= today && today < m.end);
    const pushMaha = (m: DashaPeriod | undefined) => {
      if (!m) return;
      periods.push({ id: `maha:${m.lord}:${m.start}`, when: classify(m.start, m.end, today), kind: "mahadasha", start: m.start, end: m.end, lord: m.lord });
    };
    if (currentIndex >= 0) {
      pushMaha(mahas[currentIndex - 2]);
      pushMaha(mahas[currentIndex - 1]);
      const current = mahas[currentIndex]!;
      pushMaha(current);
      const subs = current.subPeriods ?? [];
      const subIndex = subs.findIndex((s) => s.start <= today && today < s.end);
      const chosen = [subs[subIndex - 1], subs[subIndex], subs[subIndex + 1], subs[subIndex + 2]];
      for (const s of chosen) {
        if (!s) continue;
        periods.push({ id: `antar:${current.lord}:${s.lord}:${s.start}`, when: classify(s.start, s.end, today), kind: "antardasha", start: s.start, end: s.end, lord: s.lord, parentLord: current.lord });
      }
      // The next mahadasha only if it begins within five years.
      const next = mahas[currentIndex + 1];
      if (next && next.start <= addYears(today, 5)) pushMaha(next);
    }
  }
  for (const p of chart.transits.sadeSati) {
    periods.push({ id: `sadesati:${p.start}`, when: classify(p.start, p.end, today), kind: "sade_sati", start: p.start, end: p.end, transit: p });
  }
  const horizon = addYears(today, 2);
  for (const p of chart.transits.saturnFromMoon.filter((x) => x.end > today && x.start <= horizon).slice(0, 3)) {
    periods.push({ id: `saturn_moon:${p.detail}:${p.start}`, when: classify(p.start, p.end, today), kind: "saturn_from_moon", start: p.start, end: p.end, transit: p, house: houseOf(p) });
  }
  for (const p of chart.transits.jupiterFromMoon.filter((x) => x.end > today && x.start <= horizon).slice(0, 4)) {
    periods.push({ id: `jupiter_moon:${p.detail}:${p.start}`, when: classify(p.start, p.end, today), kind: "jupiter_from_moon", start: p.start, end: p.end, transit: p, house: houseOf(p) });
  }
  return dedupe(periods).sort((a, b) => a.start.localeCompare(b.start));
}

function westernPeriods(chart: Extract<ChartData, { kind: "western" }>, today: string): ReportPeriod[] {
  const oneYearAgo = addYears(today, -1);
  const periods = chart.transits
    .filter((t) => (t.aspect === "return" ? true : t.end >= oneYearAgo))
    .map((t) => ({
      id: `transit:${t.body}:${t.aspect}:${t.target}:${t.start}`,
      when: classify(t.start, t.end, today),
      kind: "transit" as const,
      start: t.start,
      end: t.end,
      transit: t,
    }));
  return dedupe(periods).slice(0, 12);
}

function houseOf(p: TransitPeriod): number | undefined {
  const match = /house_(\d+)_from_moon/.exec(p.detail ?? "");
  return match ? Number(match[1]) : undefined;
}

function dedupe(periods: ReportPeriod[]): ReportPeriod[] {
  const seen = new Set<string>();
  return periods.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Current mahadasha / antardasha at the reference date (Indian reports). */
export function currentDasha(chart: ChartData, today: string): { maha: DashaPeriod; antar: DashaPeriod | null } | null {
  if (chart.kind !== "vedic") return null;
  const timeline = chart.dasha.status === "known" ? chart.dasha.value : null;
  const maha = timeline?.mahadashas.find((m) => m.start <= today && today < m.end);
  if (!maha) return null;
  return { maha, antar: maha.subPeriods?.find((s) => s.start <= today && today < s.end) ?? null };
}
