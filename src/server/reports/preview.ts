import { NAKSHATRA_NAMES_EN, SIGN_NAMES_EN, type SignKey } from "@/domain/astrology/constants";
import { getDictionary } from "@/i18n";
import { CHART_SVG_CSS, southIndianChartSvg } from "./chart-svg";
import { buildSampleReport } from "./sample";

/**
 * Homepage "what you receive" previews, taken from the public SAMPLE report: a
 * fictional person, a genuinely calculated chart, and hand-written illustrative text
 * that matches it. Nothing here is a real customer, and the page labels it as a sample.
 */
export interface ReportPreview {
  title: string;
  subject: string;
  reference: string;
  chartSvg: string;
  chartCss: string;
  glance: { label: string; value: string }[];
  overview: { headline: string; excerpt: string };
  career: string;
  relationships: string;
  ahead: { title: string; dates: string; excerpt: string };
}

const DASH = /[-‐-―]/;

/** Leading sentences (up to ~max characters) that contain no dash, so the page keeps its house style. */
function excerpt(paragraphs: readonly string[], max = 230): string {
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let out = "";
    for (const s of sentences) {
      if (DASH.test(s)) break;
      if (out && (out + " " + s).length > max) break;
      out = out ? `${out} ${s}` : s;
    }
    if (out) return out;
  }
  return "";
}

const year = (iso: string) => iso.slice(0, 4);
const rasi = (sign: SignKey) => `${SIGN_NAMES_EN[sign].sanskrit} (${SIGN_NAMES_EN[sign].western})`;

let cached: ReportPreview | null = null;

export async function getReportPreview(): Promise<ReportPreview> {
  if (cached) return cached;
  const doc = await buildSampleReport();
  const dict = getDictionary("en");
  const chart = doc.chart;
  if (chart.kind !== "vedic") throw new Error("The sample report is an Indian chart");

  const glance: ReportPreview["glance"] = [];
  if (chart.lagna.status === "known") {
    const deg = chart.lagna.value.longitude % 30;
    glance.push({ label: "Lagna", value: `${rasi(chart.lagna.value.sign)} ${Math.floor(deg)}°${String(Math.round((deg % 1) * 60)).padStart(2, "0")}′` });
  }
  if (chart.moonSign.status === "known") glance.push({ label: "Rasi", value: rasi(chart.moonSign.value) });
  if (chart.moonNakshatra.status === "known") {
    glance.push({ label: "Nakshatra", value: `${NAKSHATRA_NAMES_EN[chart.moonNakshatra.value]}${chart.moonPada.status === "known" ? `, pada ${chart.moonPada.value}` : ""}` });
  }

  const { core, timeline } = doc.interpretation;
  const aheadEntry = timeline.lookingAhead.periods.find((p) => p.periodId.startsWith("maha:")) ?? timeline.lookingAhead.periods[0];
  const aheadPeriod = doc.periods.find((p) => p.id === aheadEntry?.periodId);
  const lord = aheadPeriod?.lord;

  cached = {
    title: tradTitle(doc.tradition),
    subject: doc.subject.name,
    reference: doc.orderReference,
    chartSvg: southIndianChartSvg(chart, dict, dict.labels.southIndianChart).value,
    chartCss: CHART_SVG_CSS.value,
    glance,
    overview: { headline: core.overview.headline, excerpt: excerpt(core.overview.paragraphs) },
    career: excerpt(timeline.lifeAreas.career),
    relationships: excerpt(timeline.lifeAreas.relationships),
    ahead: {
      title: lord ? `${lord.charAt(0).toUpperCase()}${lord.slice(1)} mahadasha` : "The period ahead",
      dates: aheadPeriod ? `${year(aheadPeriod.start)} to ${year(aheadPeriod.end)}` : "",
      excerpt: excerpt(aheadEntry?.paragraphs ?? [], 330),
    },
  };
  return cached;
}

function tradTitle(tradition: "indian" | "western"): string {
  return tradition === "indian" ? "Indian (Vedic) Astrology Report" : "Western Astrology Report";
}
