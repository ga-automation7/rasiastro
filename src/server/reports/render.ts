import { getLanguage } from "@/config/languages";
import type { Fact, Placement } from "@/domain/astrology/chart-types";
import { SIGN_NAMES_EN, formatDegreeInSign, normalizeDegrees, type NakshatraKey, type PlanetKey, type SignKey } from "@/domain/astrology/constants";
import { formatDate, getDictionary, type ReportDictionary } from "@/i18n";
import { perspectivesFor } from "../interpretation/perspectives";
import { CHART_SVG_CSS, northIndianChartSvg, southIndianChartSvg } from "./chart-svg";
import type { ReportDocument } from "./document";
import { html, join, raw, type RawHtml } from "./html";
import { currentDasha, type ReportPeriod } from "./periods";

/**
 * Renders a ReportDocument to HTML. The same markup is used for the web report and
 * the PDF; only the surrounding page (fonts, @page rules) differs.
 */
interface Ctx {
  doc: ReportDocument;
  dict: ReportDictionary;
}

function signName(ctx: Ctx, sign: SignKey): string {
  if (ctx.doc.language === "en" && ctx.doc.tradition === "indian") return `${SIGN_NAMES_EN[sign].sanskrit} (${SIGN_NAMES_EN[sign].western})`;
  return ctx.dict.signs[sign];
}

function factText<T>(ctx: Ctx, fact: Fact<T>, show: (value: T) => string): string {
  if (fact.status === "known") return show(fact.value);
  if (fact.status === "uncertain") {
    const options = fact.candidates.length ? fact.candidates.map(show).join(" / ") : fact.atStatedTime !== null ? show(fact.atStatedTime) : "?";
    return `${ctx.dict.labels.oneOf}: ${options}`;
  }
  return ctx.dict.labels.notCalculated;
}

function tithiName(dict: ReportDictionary, tithi: number): string {
  const shukla = tithi <= 15;
  const index = (tithi - 1) % 15;
  const name = index < 14 ? dict.tithis[index]! : shukla ? dict.tithis[14]! : dict.tithis[15]!;
  return `${shukla ? dict.pakshas.shukla : dict.pakshas.krishna} - ${name}`;
}

function degreeText(p: Placement): string {
  if (p.longitude !== null) return formatDegreeInSign(p.longitude);
  const [min, max] = p.longitudeRange;
  if (max - min >= 30) return "-";
  return `${formatDegreeInSign(min)}–${formatDegreeInSign(normalizeDegrees(max))}`;
}

function section(id: string, title: string, body: RawHtml, extraClass = ""): RawHtml {
  return html`<section class="report-section ${extraClass}" id="${id}"><h2>${title}</h2>${body}</section>`;
}

function paragraphs(list: string[]): RawHtml {
  return join(list.map((p) => html`<p>${p}</p>`));
}

function table(headers: string[], rows: (string | RawHtml)[][], className = ""): RawHtml {
  return html`<div class="table-wrap"><table class="report-table ${className}">
    <thead><tr>${join(headers.map((h) => html`<th scope="col">${h}</th>`))}</tr></thead>
    <tbody>${join(rows.map((r) => html`<tr>${join(r.map((c, i) => (i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`)))}</tr>`))}</tbody>
  </table></div>`;
}

function periodTitle(ctx: Ctx, p: ReportPeriod): string {
  const { dict } = ctx;
  switch (p.kind) {
    case "mahadasha":
      return dict.periods.mahadasha(dict.planets[p.lord!]);
    case "antardasha":
      return dict.periods.antardasha(dict.planets[p.lord!], dict.planets[p.parentLord!]);
    case "sade_sati":
      return dict.periods.sadeSati;
    case "saturn_from_moon":
      return dict.periods.saturnFromMoon(p.house ?? 0);
    case "jupiter_from_moon":
      return dict.periods.jupiterFromMoon(p.house ?? 0);
    case "transit": {
      const t = p.transit!;
      const body = dict.planets[t.body];
      if (t.aspect === "return") return dict.periods.planetReturn(body);
      const target = t.target === "ascendant" ? dict.angles.ascendant : dict.planets[t.target as PlanetKey] ?? t.target;
      const aspect = t.aspect === "sign" ? "" : dict.aspects[t.aspect];
      return dict.periods.transit(body, aspect, target);
    }
  }
}

function dateRange(ctx: Ctx, start: string, end: string): string {
  return `${formatDate(start, ctx.dict)} – ${formatDate(end, ctx.dict)}`;
}

function birthDetails(ctx: Ctx): RawHtml {
  const { doc, dict } = ctx;
  const s = doc.subject;
  const time =
    s.timeCertainty === "unknown"
      ? dict.labels.timeUnknown
      : `${s.birthTime} (${s.timeCertainty === "exact" ? dict.labels.timeExact : dict.labels.timeApproximate(s.windowMinutes ?? 0)})`;
  const coords = `${Math.abs(s.latitude).toFixed(4)}° ${s.latitude >= 0 ? "N" : "S"}, ${Math.abs(s.longitude).toFixed(4)}° ${s.longitude >= 0 ? "E" : "W"}`;
  return table(
    [dict.sections.birthDetails, ""],
    [
      [dict.labels.name, s.name],
      [dict.labels.dateOfBirth, formatDate(s.birthDate, dict)],
      [dict.labels.timeOfBirth, time],
      [dict.labels.placeOfBirth, s.placeLabel],
      [dict.labels.coordinates, coords],
      [dict.labels.timeZone, `${s.timezoneId} (${s.utcOffsetLabel})`],
      [dict.labels.orderReference, doc.orderReference],
      [dict.labels.reportLanguage, getLanguage(doc.language).nativeName],
    ],
    "kv-table",
  );
}

function factRows(ctx: Ctx): string[][] {
  const { doc, dict } = ctx;
  const chart = doc.chart;
  const rows: string[][] = [];
  if (chart.kind === "vedic") {
    rows.push([dict.labels.lagna, factText(ctx, chart.lagna, (l) => `${signName(ctx, l.sign)} ${formatDegreeInSign(l.longitude)}`)]);
    rows.push([dict.labels.rasi, factText(ctx, chart.moonSign, (s) => signName(ctx, s))]);
    rows.push([dict.labels.janmaNakshatra, `${factText(ctx, chart.moonNakshatra, (n: NakshatraKey) => dict.nakshatras[n])}${chart.moonPada.status === "known" ? `, ${dict.labels.pada} ${chart.moonPada.value}` : ""}`]);
    rows.push([dict.labels.sunSign, factText(ctx, chart.sunSign, (s) => signName(ctx, s))]);
    rows.push([dict.labels.tithi, factText(ctx, chart.panchanga.tithi, (t) => tithiName(dict, t))]);
    rows.push([dict.labels.vara, factText(ctx, chart.panchanga.vara, (v) => dict.weekdays[v]!)]);
    rows.push([dict.labels.tamilMonth, factText(ctx, chart.calendars.tamilSolarMonth, (m) => dict.tamilMonths[m]!)]);
    const lunar = (m: { index: number; adhika: boolean }) => `${dict.lunarMonths[m.index]}${m.adhika ? ` (${dict.labels.adhika})` : ""}`;
    rows.push([dict.labels.amantaMonth, factText(ctx, chart.calendars.amantaMonth, lunar)]);
    rows.push([dict.labels.purnimantaMonth, factText(ctx, chart.calendars.purnimantaMonth, lunar)]);
    rows.push([dict.labels.dashaAtBirth, factText(ctx, chart.dashaLordAtBirth, (g) => dict.planets[g])]);
    const current = currentDasha(chart, doc.preparedOn);
    if (current) {
      rows.push([
        dict.labels.currentDasha,
        `${dict.planets[current.maha.lord]}${current.antar ? ` / ${dict.planets[current.antar.lord]}` : ""} (${dateRange(ctx, current.antar?.start ?? current.maha.start, current.antar?.end ?? current.maha.end)})`,
      ]);
    }
    rows.push([dict.labels.ayanamsa, `${chart.ayanamsaDegrees.toFixed(4)}° (Lahiri)`]);
  } else {
    const sun = chart.bodies.find((b) => b.key === "sun")!;
    const moon = chart.bodies.find((b) => b.key === "moon")!;
    rows.push([dict.labels.sunSign, factText(ctx, sun.sign, (s) => signName(ctx, s))]);
    rows.push([dict.labels.moonSign, factText(ctx, moon.sign, (s) => signName(ctx, s))]);
    rows.push([dict.labels.ascendant, factText(ctx, chart.ascendant, (a) => `${signName(ctx, a.sign)} ${formatDegreeInSign(a.longitude)}`)]);
    rows.push([dict.labels.midheaven, factText(ctx, chart.midheaven, (a) => `${signName(ctx, a.sign)} ${formatDegreeInSign(a.longitude)}`)]);
    rows.push([dict.labels.sect, factText(ctx, chart.sect, (s) => (s === "day" ? dict.labels.dayChart : dict.labels.nightChart))]);
    rows.push([dict.labels.elementBalance, (Object.keys(chart.elementBalance) as (keyof typeof chart.elementBalance)[]).map((k) => `${dict.elements[k]} ${chart.elementBalance[k]}`).join(" · ")]);
    rows.push([dict.labels.modalityBalance, (Object.keys(chart.modalityBalance) as (keyof typeof chart.modalityBalance)[]).map((k) => `${dict.modalities[k]} ${chart.modalityBalance[k]}`).join(" · ")]);
  }
  return rows;
}

/** Label for a fact id used in AI chart explanations. */
function factLabel(ctx: Ctx, id: string): string {
  const { dict } = ctx;
  const map: Record<string, string> = {
    lagna: dict.labels.lagna,
    moon_sign: ctx.doc.tradition === "indian" ? dict.labels.rasi : dict.labels.moonSign,
    nakshatra: dict.labels.janmaNakshatra,
    pada: dict.labels.pada,
    sun_sign: dict.labels.sunSign,
    dasha_at_birth: dict.labels.dashaAtBirth,
    current_dasha: dict.labels.currentDasha,
    tithi: dict.labels.tithi,
    ascendant: dict.labels.ascendant,
    midheaven: dict.labels.midheaven,
    sect: dict.labels.sect,
    elements: dict.labels.elementBalance,
    modalities: dict.labels.modalityBalance,
  };
  if (map[id]) return map[id]!;
  const planet = /^planet_(\w+)$/.exec(id)?.[1] as PlanetKey | undefined;
  return planet && dict.planets[planet] ? dict.planets[planet] : id;
}

function planetTable(ctx: Ctx): RawHtml {
  const { doc, dict } = ctx;
  const chart = doc.chart;
  const placements = chart.kind === "vedic" ? chart.grahas : chart.bodies;
  const vedic = chart.kind === "vedic";
  const headers = [dict.labels.planet, dict.labels.sign, dict.labels.degree, ...(vedic ? [`${dict.labels.nakshatra} (${dict.labels.pada})`] : []), dict.labels.house, dict.labels.dignity];
  const rows = placements.map((p) => {
    const name = `${dict.planets[p.key]}${p.retrograde && p.key !== "rahu" && p.key !== "ketu" ? ` (${dict.labels.retrograde})` : ""}`;
    const nak = p.nakshatra ? `${factText(ctx, p.nakshatra, (n: NakshatraKey) => dict.nakshatras[n])}${p.pada && p.pada.status === "known" ? ` (${p.pada.value})` : ""}` : "";
    return [
      name,
      factText(ctx, p.sign, (s) => signName(ctx, s)),
      degreeText(p),
      ...(vedic ? [nak] : []),
      p.house.status === "omitted" ? "-" : factText(ctx, p.house, (h) => String(h)),
      p.dignity ? factText(ctx, p.dignity, (d) => dict.dignities[d]) : "-",
    ];
  });
  return table(headers, rows, "planet-table");
}

function aspectTable(ctx: Ctx): RawHtml | null {
  const { doc, dict } = ctx;
  if (doc.chart.kind !== "western" || doc.chart.aspects.length === 0) return null;
  const pointName = (k: string) => (k === "ascendant" ? dict.angles.ascendant : k === "midheaven" ? dict.angles.midheaven : dict.planets[k as PlanetKey]);
  const rows = [...doc.chart.aspects]
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 16)
    .map((a) => [`${pointName(a.a)} – ${pointName(a.b)}`, dict.aspects[a.type], `${a.orb.toFixed(1)}°`]);
  return table(["", "", dict.labels.orb], rows);
}

function chartsSection(ctx: Ctx): RawHtml | null {
  const { doc, dict } = ctx;
  if (doc.chart.kind !== "vedic") return null;
  const south = southIndianChartSvg(doc.chart, dict, dict.labels.southIndianChart);
  const north = northIndianChartSvg(doc.chart, dict, dict.labels.northIndianChart);
  return section(
    "charts",
    dict.sections.charts,
    html`<div class="chart-grid">
      <figure class="chart-figure">${south}<figcaption>${dict.labels.southIndianChart}</figcaption></figure>
      <figure class="chart-figure">${north ?? html`<p class="muted">${dict.notes.northChartNeedsTime}</p>`}<figcaption>${dict.labels.northIndianChart}</figcaption></figure>
    </div>`,
  );
}

function perspectivesSection(ctx: Ctx): RawHtml {
  const { doc, dict } = ctx;
  const specs = perspectivesFor(doc.tradition);
  const perspectiveNames = Object.fromEntries(specs.map((s) => [s.key, s.name]));
  const localizedTitle = (key: string) => {
    const titles: Record<string, Record<string, string>> = {
      tamil: { en: "Tamil perspective", ta: "தமிழ் பார்வை", hi: "तमिल दृष्टिकोण", te: "తమిళ దృక్కోణం", kn: "ತಮಿಳು ದೃಷ್ಟಿಕೋನ", ml: "തമിഴ് വീക്ഷണം" },
      kannada: { en: "Kannada perspective", ta: "கன்னட பார்வை", hi: "कन्नड़ दृष्टिकोण", te: "కన్నడ దృక్కోణం", kn: "ಕನ್ನಡ ದೃಷ್ಟಿಕೋನ", ml: "കന്നഡ വീക്ഷണം" },
      north_indian: { en: "North Indian (Hindi-context) perspective", ta: "வட இந்திய (இந்தி சூழல்) பார்வை", hi: "उत्तर भारतीय (हिंदी संदर्भ) दृष्टिकोण", te: "ఉత్తర భారత (హిందీ సందర్భం) దృక్కోణం", kn: "ಉತ್ತರ ಭಾರತದ (ಹಿಂದಿ ಸಂದರ್ಭ) ದೃಷ್ಟಿಕೋನ", ml: "ഉത്തരേന്ത്യൻ (ഹിന്ദി പശ്ചാത്തലം) വീക്ഷണം" },
      modern_psychological: { en: "Modern psychological perspective", ta: "நவீன உளவியல் பார்வை", hi: "आधुनिक मनोवैज्ञानिक दृष्टिकोण", te: "ఆధునిక మనోవైజ్ఞానిక దృక్కోణం", kn: "ಆಧುನಿಕ ಮನೋವೈಜ್ಞಾನಿಕ ದೃಷ್ಟಿಕೋನ", ml: "ആധുനിക മനശ്ശാസ്ത്ര വീക്ഷണം" },
      traditional: { en: "Traditional perspective", ta: "பாரம்பரியப் பார்வை", hi: "पारंपरिक दृष्टिकोण", te: "సంప్రదాయ దృక్కోణం", kn: "ಸಾಂಪ್ರದಾಯಿಕ ದೃಷ್ಟಿಕೋನ", ml: "പരമ്പരാഗത വീക്ഷണം" },
    };
    return titles[key]?.[doc.language] ?? perspectiveNames[key] ?? key;
  };
  const items = doc.interpretation.core.perspectives.map(
    (p) => html`<article class="perspective">
      <h3>${localizedTitle(p.key)}</h3>
      <ul class="chips">${join(p.keyThemes.map((t) => html`<li>${t}</li>`))}</ul>
      ${paragraphs(p.paragraphs)}
    </article>`,
  );
  return section(
    "perspectives",
    doc.tradition === "indian" ? dict.sections.perspectivesIndian : dict.sections.perspectivesWestern,
    html`<p class="note">${doc.tradition === "indian" ? dict.notes.regionalPerspectives : dict.notes.westernPerspectives}</p>${join(items)}`,
  );
}

function periodBlocks(ctx: Ctx, items: { periodId: string; paragraphs: string[]; opportunities?: string[]; challenges?: string[] }[]): RawHtml {
  const { doc, dict } = ctx;
  const byId = new Map(doc.periods.map((p) => [p.id, p]));
  if (items.length === 0) return html`<p class="muted">${dict.notes.noPeriods}</p>`;
  return join(
    items.map((item) => {
      const period = byId.get(item.periodId);
      if (!period) return html``;
      return html`<article class="period">
        <h3>${periodTitle(ctx, period)}</h3>
        <p class="period-dates">${dateRange(ctx, period.start, period.end)}</p>
        ${paragraphs(item.paragraphs)}
        ${item.opportunities?.length ? html`<div class="pill-row"><strong>${dict.labels.opportunities}:</strong> ${item.opportunities.join(" · ")}</div>` : ""}
        ${item.challenges?.length ? html`<div class="pill-row"><strong>${dict.labels.challenges}:</strong> ${item.challenges.join(" · ")}</div>` : ""}
      </article>`;
    }),
  );
}

function discrepancySection(ctx: Ctx): RawHtml | null {
  const { doc, dict } = ctx;
  if (!doc.customerNotes && doc.discrepancies.length === 0 && !doc.interpretation.synthesis.contextResponse) return null;
  const show = (field: string, value: string) =>
    field === "nakshatra" ? dict.nakshatras[value as NakshatraKey] ?? value : field === "pada" ? value : signName(ctx, value as SignKey);
  const rows = doc.discrepancies.map((d) => [
    dict.discrepancy.fields[d.field],
    show(d.field, d.customerValue),
    d.verdict === "unverifiable" ? dict.labels.notCalculated : d.candidates.length ? `${dict.labels.oneOf}: ${d.candidates.map((c) => show(d.field, c)).join(" / ")}` : show(d.field, d.calculatedValue ?? ""),
    dict.discrepancy.verdicts[d.verdict],
  ]);
  return section(
    "context",
    dict.sections.yourContext,
    html`${rows.length ? html`<h3>${dict.sections.discrepancies}</h3>${table(["", dict.labels.customerSaid, dict.labels.calculated, ""], rows)}` : ""}
      ${doc.interpretation.synthesis.contextResponse ? html`<p>${doc.interpretation.synthesis.contextResponse}</p>` : ""}`,
  );
}

function limitations(ctx: Ctx): string[] {
  const { doc, dict } = ctx;
  const list: string[] = [];
  if (doc.subject.timeCertainty === "unknown") list.push(doc.tradition === "indian" ? dict.limitations.timeUnknownIndian : dict.limitations.timeUnknownWestern);
  if (doc.subject.timeCertainty === "approximate") list.push(dict.limitations.timeApproximate(doc.subject.windowMinutes ?? 0));
  if (doc.chart.conventions.houseSystem === "porphyry") list.push(dict.limitations.polar);
  if (doc.chart.kind === "vedic" && doc.chart.dasha.status === "known" && doc.chart.dasha.value.uncertaintyDays > 0) {
    list.push(dict.labels.dashaShift(doc.chart.dasha.value.uncertaintyDays));
  }
  list.push(dict.limitations.general);
  return list;
}

export function renderReportBody(doc: ReportDocument): RawHtml {
  const dict = getDictionary(doc.language);
  const ctx: Ctx = { doc, dict };
  const { core, timeline, synthesis } = doc.interpretation;
  const banner = doc.kind === "sample" ? dict.notes.sampleBanner : doc.isDemo ? dict.notes.demoBanner : null;
  const title = doc.tradition === "indian" ? dict.sections.reportTitleIndian : dict.sections.reportTitleWestern;
  const lifeAreas: [string, string[]][] = [
    [dict.labels.career, timeline.lifeAreas.career],
    [dict.labels.relationships, timeline.lifeAreas.relationships],
    [dict.labels.personalGrowth, timeline.lifeAreas.personalGrowth],
    [dict.labels.money, timeline.lifeAreas.money],
  ];

  return html`<article class="report" lang="${getLanguage(doc.language).htmlLang}">
    ${banner ? html`<p class="report-banner" role="note">${banner}</p>` : ""}
    <header class="report-cover">
      <p class="brand">Rasi Astro · <span>Your stars, your story.</span></p>
      <h1>${title}</h1>
      <p class="cover-name">${doc.subject.name}</p>
      <p class="cover-meta">${dict.labels.orderReference}: ${doc.orderReference} · ${dict.labels.generatedOn}: ${formatDate(doc.preparedOn, dict)}</p>
      <p class="cover-headline">${core.overview.headline}</p>
    </header>
    ${section("overview", dict.sections.overview, paragraphs(core.overview.paragraphs))}
    ${section("birth", dict.sections.birthDetails, birthDetails(ctx))}
    ${section(
      "conventions",
      dict.sections.conventions,
      html`<ul class="bullets">${join(doc.chart.conventions.notes.map((n) => html`<li>${dict.conventions[n] ?? n}</li>`))}</ul>`,
    )}
    ${section("limitations", dict.sections.limitations, html`<ul class="bullets">${join(limitations(ctx).map((l) => html`<li>${l}</li>`))}</ul>`)}
    ${section("facts", dict.sections.chartFacts, table([dict.sections.chartFacts, ""], factRows(ctx), "kv-table"))}
    ${chartsSection(ctx) ?? ""}
    ${section("planets", dict.sections.planets, planetTable(ctx))}
    ${aspectTable(ctx) ? section("aspects", dict.sections.aspects, aspectTable(ctx)!) : ""}
    ${section(
      "explanations",
      dict.sections.chartExplanations,
      join(core.chartExplanations.map((e) => html`<div class="explanation"><h3>${factLabel(ctx, e.factId)}</h3><p>${e.explanation}</p></div>`)),
    )}
    ${perspectivesSection(ctx)}
    ${section("looking-back", dict.sections.lookingBack, html`<p class="note">${dict.notes.lookingBackNote}</p><p>${timeline.lookingBack.intro}</p>${periodBlocks(ctx, timeline.lookingBack.periods)}`)}
    ${section("looking-ahead", dict.sections.lookingAhead, html`<p>${timeline.lookingAhead.intro}</p>${periodBlocks(ctx, timeline.lookingAhead.periods)}`)}
    ${section("life-areas", dict.sections.lifeAreas, join(lifeAreas.map(([label, text]) => html`<article class="life-area"><h3>${label}</h3>${paragraphs(text)}</article>`)))}
    ${section(
      "agree-differ",
      dict.sections.agreeDiffer,
      html`<h3>${dict.labels.agreements}</h3><ul class="bullets">${join(synthesis.agreements.map((a) => html`<li>${a}</li>`))}</ul>
        ${synthesis.differences.length ? html`<h3>${dict.labels.differences}</h3><ul class="bullets">${join(synthesis.differences.map((d) => html`<li>${d}</li>`))}</ul>` : ""}`,
    )}
    ${section("summary", dict.sections.summary, paragraphs(synthesis.combinedSummary))}
    ${discrepancySection(ctx) ?? ""}
    ${
      doc.questions.length
        ? section(
            "questions",
            dict.sections.questions,
            join(
              synthesis.questionAnswers
                .sort((a, b) => a.questionNumber - b.questionNumber)
                .map((qa) => html`<article class="qa"><h3>${dict.labels.question(qa.questionNumber)}</h3><blockquote>${doc.questions[qa.questionNumber - 1] ?? ""}</blockquote>${paragraphs(qa.answer)}</article>`),
            ),
          )
        : ""
    }
    ${section(
      "about",
      dict.sections.about,
      html`<p>${dict.disclaimer}</p>
        <p class="tech">${doc.calculation.provider} ${doc.calculation.calculationVersion} · ${doc.chart.conventions.ephemeris} · ${doc.chart.conventions.timeZoneDatabase} · ${doc.interpretation.promptVersion} · ${doc.interpretation.provider}/${doc.interpretation.model} · ${doc.schemaVersion}</p>`,
    )}
  </article>`;
}

/** Visual styles shared by the web report and the PDF. Colours come from CSS variables. */
export const REPORT_CSS = raw(`
.report { color: var(--r-ink); font-family: var(--r-font); line-height: 1.65; font-size: 15px; }
.report :lang(ta), .report:lang(ta), .report:lang(ml), .report:lang(kn), .report:lang(te), .report:lang(hi) { line-height: 1.8; }
.report h1, .report h2, .report h3 { font-family: var(--r-heading-font); color: var(--r-heading); line-height: 1.35; }
.report h1 { font-size: 30px; margin: 8px 0 6px; font-weight: 600; }
.report h2 { font-size: 21px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--r-rule); font-weight: 600; break-after: avoid; }
.report h3 { font-size: 16.5px; margin: 18px 0 6px; font-weight: 600; break-after: avoid; }
.report p { margin: 0 0 11px; }
.report-banner { background: var(--r-banner-bg); color: var(--r-banner-ink); border: 1px solid var(--r-banner-line); padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; }
.report-cover { padding: 28px 0 22px; border-bottom: 2px solid var(--r-gold); margin-bottom: 26px; }
.report-cover .brand { color: var(--r-gold-ink); letter-spacing: 0.06em; font-size: 13px; text-transform: uppercase; margin: 0; }
.report-cover .brand span { text-transform: none; letter-spacing: 0; font-style: italic; }
.cover-name { font-size: 20px; margin: 4px 0; font-weight: 600; }
.cover-meta { color: var(--r-muted); font-size: 13px; }
.cover-headline { font-family: var(--r-heading-font); font-size: 18px; font-style: italic; color: var(--r-heading); margin-top: 14px; }
.report-section { margin: 0 0 30px; }
.note { background: var(--r-note-bg); border-left: 3px solid var(--r-gold); padding: 8px 12px; font-size: 13.5px; color: var(--r-muted-ink); }
.muted { color: var(--r-muted); }
.bullets { padding-left: 20px; margin: 0 0 10px; }
.bullets li { margin-bottom: 6px; }
.table-wrap { overflow-x: auto; }
.report-table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 4px 0 12px; }
.report-table th, .report-table td { text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--r-rule); vertical-align: top; }
.report-table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--r-muted); font-weight: 600; }
.report-table tbody th { font-weight: 600; color: var(--r-heading); }
.report-table tr { break-inside: avoid; }
.kv-table thead { display: none; }
.kv-table tbody th { width: 38%; }
.chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.chart-figure { margin: 0; break-inside: avoid; }
.chart-figure figcaption { text-align: center; font-size: 13px; color: var(--r-muted); margin-top: 6px; }
.perspective, .period, .life-area, .qa, .explanation { break-inside: avoid-page; }
.chips { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.chips li { background: var(--r-chip-bg); color: var(--r-chip-ink); border-radius: 999px; padding: 2px 10px; font-size: 12.5px; }
.period-dates { color: var(--r-gold-ink); font-size: 13px; font-weight: 600; margin-top: -2px; }
.pill-row { font-size: 13.5px; margin: 4px 0; }
blockquote { margin: 0 0 10px; padding: 8px 12px; background: var(--r-note-bg); border-radius: 6px; font-style: italic; }
.tech { font-size: 11px; color: var(--r-muted); word-break: break-word; }
${CHART_SVG_CSS.value}
`);
