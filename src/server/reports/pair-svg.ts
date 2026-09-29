import type { Fact, Placement, WesternChart } from "@/domain/astrology/chart-types";
import type { InterAspect } from "@/domain/astrology/compatibility-types";
import { SIGN_KEYS, SIGN_NAMES_EN, normalizeDegrees, type SignKey, type WesternBody } from "@/domain/astrology/constants";
import type { ReportDictionary } from "@/i18n";
import { html, join, raw, type RawHtml } from "./html";

/**
 * Graphics for compatibility reports, drawn only from calculated data (no scores).
 * Person A is always drawn in indigo, person B in gold, on the web and in the PDF.
 */
const R = (deg: number) => (deg * Math.PI) / 180;
const f = (n: number) => Math.round(n * 10) / 10;

function signLabel(dict: ReportDictionary, sign: SignKey, indian: boolean): string {
  return indian && dict.code === "en" ? SIGN_NAMES_EN[sign].sanskrit : dict.signs[sign];
}

function candidates(fact: Fact<SignKey>): { signs: SignKey[]; uncertain: boolean } {
  if (fact.status === "known") return { signs: [fact.value], uncertain: false };
  if (fact.status === "uncertain") return { signs: fact.candidates, uncertain: true };
  return { signs: [], uncertain: false };
}

/** Twelve-sign ring with both Moon signs marked and the count between them. */
export function moonRelationSvg(dict: ReportDictionary, a: Fact<SignKey>, b: Fact<SignKey>, names: [string, string]): RawHtml {
  const cx = 160;
  const cy = 150;
  const r1 = 92;
  const r2 = 124;
  const ca = candidates(a);
  const cb = candidates(b);
  // Signs run counter-clockwise from the left, as on a traditional wheel.
  const at = (index: number, r: number, offset = 15) => {
    const deg = index * 30 + offset;
    return { x: cx - r * Math.cos(R(deg)), y: cy + r * Math.sin(R(deg)) };
  };
  const segment = (index: number, cls: string) => {
    const p1 = at(index, r1, 0);
    const p2 = at(index, r2, 0);
    const p3 = at(index, r2, 30);
    const p4 = at(index, r1, 30);
    return html`<path class="${cls}" d="M${f(p1.x)} ${f(p1.y)} L${f(p2.x)} ${f(p2.y)} A${r2} ${r2} 0 0 0 ${f(p3.x)} ${f(p3.y)} L${f(p4.x)} ${f(p4.y)} A${r1} ${r1} 0 0 1 ${f(p1.x)} ${f(p1.y)} Z"/>`;
  };
  const cells = SIGN_KEYS.map((sign, i) => {
    const isA = ca.signs.includes(sign);
    const isB = cb.signs.includes(sign);
    const cls = isA && isB ? "pr-seg pr-both" : isA ? `pr-seg pr-a${ca.uncertain ? " pr-maybe" : ""}` : isB ? `pr-seg pr-b${cb.uncertain ? " pr-maybe" : ""}` : "pr-seg";
    const label = at(i, (r1 + r2) / 2);
    return html`${segment(i, cls)}<text x="${f(label.x)}" y="${f(label.y + 3)}" text-anchor="middle" class="pr-sign">${signLabel(dict, sign, true)}</text>`;
  });
  const knownA = a.status === "known" ? SIGN_KEYS.indexOf(a.value) : null;
  const knownB = b.status === "known" ? SIGN_KEYS.indexOf(b.value) : null;
  let connector: RawHtml = raw("");
  if (knownA !== null && knownB !== null && knownA !== knownB) {
    const pa = at(knownA, r1 - 6);
    const pb = at(knownB, r1 - 6);
    const count = ((knownB - knownA + 12) % 12) + 1;
    const back = ((knownA - knownB + 12) % 12) + 1;
    connector = html`<line x1="${f(pa.x)}" y1="${f(pa.y)}" x2="${f(pb.x)}" y2="${f(pb.y)}" class="pr-link"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" class="pr-count">${count} / ${back}</text>`;
  } else if (knownA !== null && knownA === knownB) {
    connector = html`<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="pr-count">1 / 1</text>`;
  }
  return html`<svg viewBox="0 0 320 300" class="pair-svg" role="img" aria-label="${dict.labels.rasi}">
    ${join(cells)}
    <circle cx="${cx}" cy="${cy}" r="${r1}" class="pr-inner"/>
    ${connector}
    <g class="pr-legend">
      <rect x="18" y="280" width="10" height="10" class="pr-a"/><text x="32" y="289">${names[0]}${ca.uncertain ? " ?" : ""}</text>
      <rect x="170" y="280" width="10" height="10" class="pr-b"/><text x="184" y="289">${names[1]}${cb.uncertain ? " ?" : ""}</text>
    </g>
  </svg>`;
}

interface WheelPoint {
  key: WesternBody | "ascendant";
  longitude: number;
  uncertain: boolean;
}

const WHEEL_BODIES: WesternBody[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

function wheelPoints(chart: WesternChart): WheelPoint[] {
  const points: WheelPoint[] = WHEEL_BODIES.map((key) => {
    const p = chart.bodies.find((b) => b.key === key) as Placement;
    const [lo, hi] = p.longitudeRange;
    return { key, longitude: normalizeDegrees(p.longitude ?? (lo + hi) / 2), uncertain: p.longitude === null || hi - lo > 1 };
  });
  if (chart.window.certainty === "exact" && chart.ascendant.status === "known") points.push({ key: "ascendant", longitude: chart.ascendant.value.longitude, uncertain: false });
  return points;
}

/** Spreads labels that would overlap, keeping each within a few degrees of its true place. */
function spread(points: WheelPoint[], minGap: number): Map<string, number> {
  const sorted = [...points].sort((x, y) => x.longitude - y.longitude);
  const placed = sorted.map((p) => p.longitude);
  for (let pass = 0; pass < 6; pass += 1) {
    for (let i = 1; i < placed.length; i += 1) {
      if (placed[i]! - placed[i - 1]! < minGap) placed[i] = placed[i - 1]! + minGap;
    }
  }
  return new Map(sorted.map((p, i) => [p.key, placed[i]!]));
}

/** Two-ring wheel: person A inside, person B outside, with the contacts between them. */
export function biWheelSvg(dict: ReportDictionary, a: WesternChart, b: WesternChart, aspects: InterAspect[]): RawHtml {
  const cx = 170;
  const cy = 170;
  const rOuter = 160;
  const rSigns = 136;
  const rB = 116;
  const rMid = 96;
  const rA = 76;
  const rCore = 56;
  const pos = (lon: number, r: number) => ({ x: cx - r * Math.cos(R(lon)), y: cy + r * Math.sin(R(lon)) });
  const ticks = SIGN_KEYS.map((sign, i) => {
    const p1 = pos(i * 30, rSigns);
    const p2 = pos(i * 30, rOuter);
    const label = pos(i * 30 + 15, (rSigns + rOuter) / 2);
    return html`<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}" class="bw-rule"/><text x="${f(label.x)}" y="${f(label.y + 3)}" text-anchor="middle" class="bw-sign">${dict.signs[sign]}</text>`;
  });
  const abbr = (k: WheelPoint["key"]) => (k === "ascendant" ? dict.planetAbbr.lagna : dict.planetAbbr[k]);
  const ring = (points: WheelPoint[], r: number, cls: string) => {
    const placed = spread(points, 11);
    return join(
      points.map((p) => {
        const tick1 = pos(p.longitude, r + 12);
        const tick2 = pos(p.longitude, r + 18);
        const at = pos(placed.get(p.key)!, r);
        return html`<line x1="${f(tick1.x)}" y1="${f(tick1.y)}" x2="${f(tick2.x)}" y2="${f(tick2.y)}" class="bw-tick ${cls}"/><text x="${f(at.x)}" y="${f(at.y + 4)}" text-anchor="middle" class="bw-planet ${cls}">${abbr(p.key)}${p.uncertain ? "?" : ""}</text>`;
      }),
    );
  };
  const pa = wheelPoints(a);
  const pb = wheelPoints(b);
  const lines = aspects
    .filter((x) => x.focus || x.certainty === "known")
    .slice(0, 12)
    .map((x) => {
      const la = pa.find((p) => p.key === x.a);
      const lb = pb.find((p) => p.key === x.b);
      if (!la || !lb) return raw("");
      const p1 = pos(la.longitude, rCore);
      const p2 = pos(lb.longitude, rCore);
      const tone = x.type === "trine" || x.type === "sextile" ? "bw-soft" : x.type === "conjunction" ? "bw-conj" : "bw-hard";
      return html`<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}" class="bw-aspect ${tone}${x.certainty === "uncertain" ? " bw-dashed" : ""}"/>`;
    });
  return html`<svg viewBox="0 0 340 340" class="pair-svg" role="img" aria-label="${dict.sections.aspects}">
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" class="bw-circle"/>
    <circle cx="${cx}" cy="${cy}" r="${rSigns}" class="bw-circle"/>
    <circle cx="${cx}" cy="${cy}" r="${rMid}" class="bw-circle bw-faint"/>
    <circle cx="${cx}" cy="${cy}" r="${rCore}" class="bw-circle"/>
    ${join(ticks)}
    ${join(lines)}
    ${ring(pb, rB - 4, "bw-b")}
    ${ring(pa, rA - 4, "bw-a")}
  </svg>`;
}

export const PAIR_SVG_CSS = raw(`
.pair-svg { width: 100%; max-width: 360px; height: auto; display: block; margin: 0 auto; font-family: var(--r-font); }
.pr-seg { fill: var(--chart-bg); stroke: var(--chart-line); stroke-width: 0.8; }
.pr-a { fill: var(--pair-a-soft); stroke: var(--pair-a); }
.pr-b { fill: var(--pair-b-soft); stroke: var(--pair-b); }
.pr-both { fill: var(--pair-both); stroke: var(--pair-a); }
.pr-maybe { fill-opacity: 0.55; stroke-dasharray: 3 2; }
.pr-sign { font-size: 8.5px; fill: var(--chart-ink); }
.pr-inner { fill: var(--chart-center); stroke: var(--chart-line); stroke-width: 0.8; }
.pr-link { stroke: var(--chart-ink); stroke-width: 1.2; stroke-dasharray: 4 3; }
.pr-count { font-size: 18px; font-weight: 600; fill: var(--chart-ink); }
.pr-legend text { font-size: 10.5px; fill: var(--chart-ink); }
.bw-circle { fill: none; stroke: var(--chart-line); stroke-width: 0.9; }
.bw-faint { stroke-dasharray: 2 3; }
.bw-rule { stroke: var(--chart-line); stroke-width: 0.8; }
.bw-sign { font-size: 7.5px; fill: var(--chart-muted); }
.bw-planet { font-size: 10px; font-weight: 600; }
.bw-a { fill: var(--pair-a); stroke: var(--pair-a); }
.bw-b { fill: var(--pair-b-ink); stroke: var(--pair-b); }
text.bw-a, text.bw-b { stroke: none; }
.bw-tick { stroke-width: 1.4; }
.bw-aspect { stroke-width: 1.1; opacity: 0.85; }
.bw-soft { stroke: var(--pair-soft); }
.bw-hard { stroke: var(--pair-hard); }
.bw-conj { stroke: var(--pair-b); }
.bw-dashed { stroke-dasharray: 4 3; }
`);
