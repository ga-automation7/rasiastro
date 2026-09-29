import type { Fact, Placement, VedicChart } from "@/domain/astrology/chart-types";
import { SIGN_KEYS, SIGN_NAMES_EN, type SignKey } from "@/domain/astrology/constants";
import type { ReportDictionary } from "@/i18n";
import { html, join, raw, type RawHtml } from "./html";

/**
 * Traditional Indian chart diagrams as inline SVG (identical on the web and in the
 * PDF). Planets whose sign is uncertain are shown in every candidate sign with "?".
 */
interface CellEntry {
  label: string;
  uncertain: boolean;
}

function signCandidates(fact: Fact<SignKey>): { signs: SignKey[]; uncertain: boolean } {
  if (fact.status === "known") return { signs: [fact.value], uncertain: false };
  if (fact.status === "uncertain") return { signs: fact.candidates, uncertain: true };
  return { signs: [], uncertain: false };
}

function entriesBySign(chart: VedicChart, dict: ReportDictionary): Map<SignKey, CellEntry[]> {
  const map = new Map<SignKey, CellEntry[]>(SIGN_KEYS.map((s) => [s, []]));
  const add = (sign: SignKey, entry: CellEntry) => map.get(sign)!.push(entry);
  const lagnaSign: Fact<SignKey> =
    chart.lagna.status === "known"
      ? { status: "known", value: chart.lagna.value.sign }
      : chart.lagna.status === "uncertain"
        ? { status: "uncertain", candidates: chart.lagna.candidates.map((c) => c.sign), atStatedTime: null }
        : chart.lagna;
  const lagna = signCandidates(lagnaSign);
  lagna.signs.forEach((s) => add(s, { label: dict.planetAbbr.lagna, uncertain: lagna.uncertain }));
  chart.grahas.forEach((g: Placement) => {
    const { signs, uncertain } = signCandidates(g.sign);
    const retro = g.retrograde && g.key !== "rahu" && g.key !== "ketu" ? `(${dict.retroMark})` : "";
    signs.forEach((s) => add(s, { label: `${dict.planetAbbr[g.key]}${retro}`, uncertain }));
  });
  return map;
}

/**
 * Planet labels for one house/sign, wrapped into rows of `perLine` so crowded houses
 * (four or five planets together is common) stay inside their box. `centerY` is the
 * vertical middle of the block of rows.
 */
function entryText(entries: CellEntry[], x: number, centerY: number, lineHeight: number, perLine: number): RawHtml {
  const rows: CellEntry[][] = [];
  for (let i = 0; i < entries.length; i += perLine) rows.push(entries.slice(i, i + perLine));
  const firstY = centerY - ((rows.length - 1) * lineHeight) / 2 + 4;
  return join(
    rows.map(
      (row, i) =>
        html`<text x="${x}" y="${firstY + i * lineHeight}" text-anchor="middle" class="chart-planet">${join(
          row.map((e, j) => html`<tspan class="${e.uncertain ? "chart-uncertain" : ""}">${j ? " " : ""}${e.label}${e.uncertain ? "?" : ""}</tspan>`),
        )}</text>`,
    ),
  );
}

/** Indian charts use rasi names; in English that means Mesha, Vrishabha... rather than Aries, Taurus. */
function rasiName(dict: ReportDictionary, sign: SignKey): string {
  return dict.code === "en" ? SIGN_NAMES_EN[sign].sanskrit : dict.signs[sign];
}

/** South Indian chart: signs fixed in a 4x4 frame, Pisces at top-left. */
export function southIndianChartSvg(chart: VedicChart, dict: ReportDictionary, title: string): RawHtml {
  const cell = 90;
  const positions: Record<SignKey, [number, number]> = {
    pisces: [0, 0], aries: [1, 0], taurus: [2, 0], gemini: [3, 0],
    aquarius: [0, 1], cancer: [3, 1],
    capricorn: [0, 2], leo: [3, 2],
    sagittarius: [0, 3], scorpio: [1, 3], libra: [2, 3], virgo: [3, 3],
  };
  const entries = entriesBySign(chart, dict);
  const cells = SIGN_KEYS.map((sign) => {
    const [cx, cy] = positions[sign];
    const x = cx * cell;
    const y = cy * cell;
    return html`<g>
      <rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="chart-cell"/>
      <text x="${x + 5}" y="${y + 14}" class="chart-sign">${rasiName(dict, sign)}</text>
      ${entryText(entries.get(sign)!, x + cell / 2, y + 52, 15, entries.get(sign)!.length > 4 ? 3 : 2)}
    </g>`;
  });
  return html`<svg viewBox="-1 -1 362 362" role="img" aria-label="${title}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
    ${join(cells)}
    <rect x="${cell}" y="${cell}" width="${cell * 2}" height="${cell * 2}" class="chart-center"/>
    <text x="180" y="176" text-anchor="middle" class="chart-title">${dict.code === "en" ? "Rasi" : dict.labels.sign}</text>
    <text x="180" y="198" text-anchor="middle" class="chart-subtitle">Rasi Astro</text>
  </svg>`;
}

/** North Indian chart: houses fixed (Lagna at the top), signs shown by number. */
export function northIndianChartSvg(chart: VedicChart, dict: ReportDictionary, title: string): RawHtml | null {
  if (chart.lagna.status !== "known") return null;
  const S = 360;
  const T: [number, number] = [S / 2, 0];
  const L: [number, number] = [0, S / 2];
  const B: [number, number] = [S / 2, S];
  const R: [number, number] = [S, S / 2];
  const C: [number, number] = [S / 2, S / 2];
  const TL: [number, number] = [0, 0];
  const TR: [number, number] = [S, 0];
  const BL: [number, number] = [0, S];
  const BR: [number, number] = [S, S];
  const P1: [number, number] = [S / 4, S / 4];
  const P2: [number, number] = [(3 * S) / 4, S / 4];
  const P3: [number, number] = [(3 * S) / 4, (3 * S) / 4];
  const P4: [number, number] = [S / 4, (3 * S) / 4];
  const houses: [number, number][][] = [
    [T, P2, C, P1], [TL, T, P1], [TL, P1, L], [L, P1, C, P4], [L, BL, P4], [BL, B, P4],
    [B, P4, C, P3], [B, BR, P3], [BR, R, P3], [R, P3, C, P2], [R, TR, P2], [TR, T, P2],
  ];
  const lagnaIndex = SIGN_KEYS.indexOf(chart.lagna.value.sign);
  const entries = entriesBySign(chart, dict);
  const cells = houses.map((poly, i) => {
    const signIndex = (lagnaIndex + i) % 12;
    const sign = SIGN_KEYS[signIndex]!;
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    // The sign number sits near the house's innermost corner; planets stack around the centroid.
    const inner = poly.reduce((best, p) => (Math.hypot(p[0] - C[0], p[1] - C[1]) < Math.hypot(best[0] - C[0], best[1] - C[1]) ? p : best));
    const nx = inner[0] + (cx - inner[0]) * 0.3;
    const ny = inner[1] + (cy - inner[1]) * 0.3 + 4;
    const list = entries.get(sign)!;
    // Top/bottom triangles are widest horizontally; side triangles are narrow, diamonds roomy.
    const horizontalTriangle = poly.length === 3 && poly.filter((p) => p !== inner).every((p, _, arr) => p[1] === arr[0]![1]);
    const perLine = poly.length === 4 ? (list.length > 3 ? 2 : 1) : horizontalTriangle ? 3 : 2;
    return html`<g>
      <text x="${nx}" y="${ny}" text-anchor="middle" class="chart-signnum">${signIndex + 1}</text>
      ${entryText(list, cx, cy, 13, perLine)}
    </g>`;
  });
  const lines = [
    [TL, BR], [TR, BL], [T, R], [R, B], [B, L], [L, T],
  ].map(([a, b]) => html`<line x1="${a![0]}" y1="${a![1]}" x2="${b![0]}" y2="${b![1]}" class="chart-line"/>`);
  return html`<svg viewBox="-1 -1 362 362" role="img" aria-label="${title}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${S}" height="${S}" class="chart-cell"/>
    ${join(lines)}
    ${join(cells)}
  </svg>`;
}

export const CHART_SVG_CSS = raw(`
.chart-svg { width: 100%; max-width: 360px; height: auto; display: block; margin: 0 auto; }
.chart-cell { fill: var(--chart-bg); stroke: var(--chart-line); stroke-width: 1.2; }
.chart-center { fill: var(--chart-center); stroke: var(--chart-line); stroke-width: 1.2; }
.chart-line { stroke: var(--chart-line); stroke-width: 1.2; }
.chart-sign { font-size: 9.5px; fill: var(--chart-muted); }
.chart-signnum { font-size: 10px; fill: var(--chart-muted); }
.chart-planet { font-size: 12px; font-weight: 600; fill: var(--chart-ink); }
.chart-uncertain { font-style: italic; fill: var(--chart-muted); }
.chart-title { font-size: 13px; font-weight: 600; fill: var(--chart-ink); }
.chart-subtitle { font-size: 10px; fill: var(--chart-muted); }
`);
