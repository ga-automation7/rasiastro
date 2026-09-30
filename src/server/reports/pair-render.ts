import { getLanguage } from "@/config/languages";
import type { Fact } from "@/domain/astrology/chart-types";
import type { IndianFactor, IndianPairAnalysis, WesternPairAnalysis } from "@/domain/astrology/compatibility-types";
import { SIGN_NAMES_EN, type NakshatraKey, type PlanetKey, type SignKey } from "@/domain/astrology/constants";
import { formatDate, getDictionary, type ReportDictionary } from "@/i18n";
import { getPairDictionary, type PairDictionary } from "@/i18n/pair";
import { southIndianChartSvg } from "./chart-svg";
import { html, join, raw, type RawHtml } from "./html";
import type { PairReportDocument } from "./pair-document";
import { biWheelSvg, moonRelationSvg } from "./pair-svg";

/**
 * Renders a compatibility report. Same markup for the web and the PDF (the PDF adds
 * fonts and page rules). All AI and customer text is escaped by the `html` template;
 * the placeholders {{A}}/{{B}} are replaced with the two names first.
 */
interface Ctx {
  doc: PairReportDocument;
  dict: ReportDictionary;
  pair: PairDictionary;
  names: [string, string];
}

function named(ctx: Ctx, text: string): string {
  return text.replaceAll("{{A}}", ctx.names[0]).replaceAll("{{B}}", ctx.names[1]);
}

function paragraphs(ctx: Ctx, list: string[]): RawHtml {
  return join(list.map((p) => html`<p>${named(ctx, p)}</p>`));
}

function section(id: string, title: string, body: RawHtml, extraClass = ""): RawHtml {
  return html`<section class="report-section ${extraClass}" id="${id}"><h2>${title}</h2>${body}</section>`;
}

function signName(ctx: Ctx, sign: SignKey): string {
  if (ctx.doc.language === "en" && ctx.doc.tradition === "indian") return `${SIGN_NAMES_EN[sign].sanskrit} (${SIGN_NAMES_EN[sign].western})`;
  return ctx.dict.signs[sign];
}

function factText<T>(ctx: Ctx, fact: Fact<T>, show: (v: T) => string): string {
  if (fact.status === "known") return show(fact.value);
  if (fact.status === "uncertain") return `${ctx.dict.labels.oneOf}: ${fact.candidates.map(show).join(" / ")} (${ctx.pair.words.dependsOnTime})`;
  return ctx.dict.labels.notCalculated;
}

function timeText(ctx: Ctx, s: PairReportDocument["people"][number]["subject"]): string {
  const { dict } = ctx;
  if (s.timeCertainty === "unknown") return dict.labels.timeUnknown;
  return `${s.birthTime} (${s.timeCertainty === "exact" ? dict.labels.timeExact : dict.labels.timeApproximate(s.windowMinutes ?? 0)})`;
}

function personCard(ctx: Ctx, index: 0 | 1): RawHtml {
  const { doc, dict } = ctx;
  const person = doc.people[index];
  const s = person.subject;
  const rows: [string, string][] = [
    [dict.labels.dateOfBirth, formatDate(s.birthDate, dict)],
    [dict.labels.timeOfBirth, timeText(ctx, s)],
    [dict.labels.placeOfBirth, s.placeLabel],
    [dict.labels.timeZone, `${s.timezoneId} (${s.utcOffsetLabel})`],
  ];
  const a = doc.analysis;
  if (a.kind === "indian") {
    const p = a.people[index];
    rows.push([dict.labels.rasi, factText(ctx, p.moonSign, (x) => signName(ctx, x))]);
    rows.push([dict.labels.janmaNakshatra, factText(ctx, p.nakshatra, (n: NakshatraKey) => dict.nakshatras[n])]);
    rows.push([dict.labels.lagna, factText(ctx, p.lagnaSign, (x) => signName(ctx, x))]);
  } else {
    const p = a.people[index];
    rows.push([dict.labels.sunSign, factText(ctx, p.sun, (x) => signName(ctx, x))]);
    rows.push([dict.labels.moonSign, factText(ctx, p.moon, (x) => signName(ctx, x))]);
    rows.push([dict.labels.ascendant, factText(ctx, p.ascendant, (x) => signName(ctx, x))]);
  }
  return html`<div class="person-card person-${index === 0 ? "a" : "b"}">
    <h3>${ctx.names[index]}</h3>
    <dl>${join(rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`))}</dl>
  </div>`;
}

function indianFactorValue(ctx: Ctx, f: IndianFactor): string {
  const { dict, pair } = ctx;
  const w = pair.words;
  switch (f.key) {
    case "moon_sign_relationship":
      return factText(ctx, f.result, (r) => `${r.axis}${getCategoryRomantic(ctx) && r.bhakootTraditionallyChallenging ? ` · ${w.bhakootLessFavourable}` : ""}`);
    case "tara":
      return factText(
        ctx,
        f.result,
        (r) =>
          `${ctx.names[0]} → ${ctx.names[1]}: ${pair.taras[r.aToB.tara]}${r.aToB.traditionallyChallenging ? ` (${w.traditionallyChallenging})` : ""} · ${ctx.names[1]} → ${ctx.names[0]}: ${pair.taras[r.bToA.tara]}${r.bToA.traditionallyChallenging ? ` (${w.traditionallyChallenging})` : ""}`,
      );
    case "gana":
      return factText(ctx, f.result, (r) => `${pair.ganas[r.a]} · ${pair.ganas[r.b]}${r.same ? ` (${w.same})` : ""}`);
    case "graha_maitri":
      return factText(ctx, f.result, (r) =>
        r.aTowardB === "same"
          ? `${dict.planets[r.aLord]} (${pair.friendship.same})`
          : `${dict.planets[r.aLord]} → ${dict.planets[r.bLord]}: ${pair.friendship[r.aTowardB]} · ${dict.planets[r.bLord]} → ${dict.planets[r.aLord]}: ${pair.friendship[r.bTowardA]}`,
      );
    case "yoni":
      return factText(ctx, f.result, (r) => `${pair.yonis[r.a]} · ${pair.yonis[r.b]}${r.relation === "same" ? ` (${w.same})` : r.relation === "traditionally_opposed" ? ` (${w.traditionallyOpposed})` : ""}`);
    case "nadi":
      return factText(ctx, f.result, (r) => `${pair.nadis[r.a]} · ${pair.nadis[r.b]}${r.same ? ` (${w.same})` : ` (${w.different})`}`);
  }
}

function getCategoryRomantic(ctx: Ctx): boolean {
  return ctx.doc.category === "relationship" || ctx.doc.category === "marriage";
}

function table(headers: string[], rows: (string | RawHtml)[][], className = ""): RawHtml {
  return html`<div class="table-wrap"><table class="report-table ${className}">
    <thead><tr>${join(headers.map((h) => html`<th scope="col">${h}</th>`))}</tr></thead>
    <tbody>${join(rows.map((r) => html`<tr>${join(r.map((c, i) => (i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`)))}</tr>`))}</tbody>
  </table></div>`;
}

function indianCharts(ctx: Ctx, a: IndianPairAnalysis): RawHtml {
  const [pa, pb] = ctx.doc.people;
  const charts =
    pa.chart.kind === "vedic" && pb.chart.kind === "vedic"
      ? html`<div class="chart-grid">
          <figure class="chart-figure">${southIndianChartSvg(pa.chart, ctx.dict, ctx.names[0])}<figcaption>${ctx.names[0]}</figcaption></figure>
          <figure class="chart-figure">${southIndianChartSvg(pb.chart, ctx.dict, ctx.names[1])}<figcaption>${ctx.names[1]}</figcaption></figure>
        </div>`
      : raw("");
  return html`${charts}
    <figure class="chart-figure pair-figure">${moonRelationSvg(ctx.dict, a.people[0].moonSign, a.people[1].moonSign, ctx.names)}<figcaption>${ctx.pair.notes.moonRelationCaption}</figcaption></figure>`;
}

function pointName(ctx: Ctx, k: string): string {
  return k === "ascendant" ? ctx.dict.angles.ascendant : ctx.dict.planets[k as PlanetKey];
}

function westernCharts(ctx: Ctx, a: WesternPairAnalysis): RawHtml {
  const [pa, pb] = ctx.doc.people;
  if (pa.chart.kind !== "western" || pb.chart.kind !== "western") return raw("");
  const elements = ["fire", "earth", "air", "water"] as const;
  const max = Math.max(1, ...elements.flatMap((e) => [a.people[0].elementBalance[e], a.people[1].elementBalance[e]]));
  const bars = elements.map(
    (e) => html`<div class="el-row"><span class="el-name">${ctx.dict.elements[e]}</span>
      <span class="el-bars">
        <span class="el-bar el-a" style="width:${Math.round((a.people[0].elementBalance[e] / max) * 100)}%"><b>${a.people[0].elementBalance[e]}</b></span>
        <span class="el-bar el-b" style="width:${Math.round((a.people[1].elementBalance[e] / max) * 100)}%"><b>${a.people[1].elementBalance[e]}</b></span>
      </span></div>`,
  );
  return html`<div class="chart-grid">
    <figure class="chart-figure pair-figure">${biWheelSvg(ctx.dict, pa.chart, pb.chart, a.interAspects)}<figcaption>${ctx.pair.notes.wheelCaption(ctx.names[0], ctx.names[1])}</figcaption></figure>
    <figure class="chart-figure"><div class="el-chart">${join(bars)}</div>
      <p class="el-legend"><span class="dot dot-a"></span>${ctx.names[0]} <span class="dot dot-b"></span>${ctx.names[1]}</p>
      <figcaption>${ctx.pair.notes.elementsCaption}</figcaption></figure>
  </div>`;
}

function factorsSection(ctx: Ctx): RawHtml {
  const { doc, pair, dict } = ctx;
  const a = doc.analysis;
  let body: RawHtml;
  if (a.kind === "indian") {
    body = table(["", ""], a.factors.map((f) => [pair.factorNames[f.key], indianFactorValue(ctx, f)]), "kv-table");
  } else {
    const rows = a.interAspects.map((x) => [
      `${ctx.names[0]}: ${pointName(ctx, x.a)} – ${ctx.names[1]}: ${pointName(ctx, x.b)}`,
      dict.aspects[x.type],
      x.certainty === "known" ? (x.orb !== null ? `${x.orbApproximate ? "≈" : ""}${x.orb.toFixed(1)}°` : "") : pair.words.dependsOnTime,
    ]);
    const overlays = a.overlays.map(
      (o) =>
        html`<h3>${pair.words.planetsInHouses(ctx.names[o.from], ctx.names[o.into])}</h3>${table(
          ["", ""],
          o.placements.map((p) => [dict.planets[p.body], factText(ctx, p.house, (h) => pair.words.house(h))]),
          "kv-table",
        )}`,
    );
    const omitted = a.overlaysOmitted.map((o) => html`<p class="muted">${pair.words.overlaysNeedTime(ctx.names[o.into])}</p>`);
    body = html`<h3>${pair.factorNames.inter_aspects}</h3>${rows.length ? table(["", "", dict.labels.orb], rows) : html`<p class="muted">-</p>`}
      <h3>${pair.factorNames.overlays}</h3>${join(overlays)}${join(omitted)}`;
  }
  return section("factors", pair.sections.factors, html`<p class="note">${pair.notes.noScore}</p>${body}`);
}

function factorLabel(ctx: Ctx, id: string): string {
  const { pair, doc, dict } = ctx;
  if (id in pair.factorNames) return pair.factorNames[id as keyof PairDictionary["factorNames"]];
  const aspect = /^aspect_(\d+)$/.exec(id);
  if (aspect && doc.analysis.kind === "western") {
    const x = doc.analysis.interAspects[Number(aspect[1]) - 1];
    if (x) return `${ctx.names[0]}: ${pointName(ctx, x.a)} · ${dict.aspects[x.type]} · ${ctx.names[1]}: ${pointName(ctx, x.b)}`;
  }
  const overlay = /^overlay_([ab])_in_([ab])$/.exec(id);
  if (overlay) return pair.words.planetsInHouses(ctx.names[overlay[1] === "a" ? 0 : 1], ctx.names[overlay[2] === "a" ? 0 : 1]);
  return id;
}

function sharedSection(ctx: Ctx): RawHtml | null {
  const { doc, pair } = ctx;
  const f = pair.sharedFields;
  const rows: [string, string][] = [];
  if (doc.shared.howKnown) rows.push([f.howKnown, doc.shared.howKnown]);
  if (doc.shared.knownDuration) rows.push([f.knownDuration, doc.shared.knownDuration]);
  if (doc.shared.hopes) rows.push([f.hopes, doc.shared.hopes]);
  if (doc.shared.sharedCircumstances) rows.push([f.sharedCircumstances, doc.shared.sharedCircumstances]);
  doc.people.forEach((p, i) => {
    if (p.notes) rows.push([f.notesAbout(ctx.names[i]!), p.notes]);
  });
  const response = doc.interpretation.pair_synthesis.contextResponse;
  if (!rows.length && !response) return null;
  return section(
    "shared",
    pair.sections.whatYouShared,
    html`<p class="note">${pair.notes.sharedIsContext}</p>${rows.length ? table(["", ""], rows, "kv-table") : ""}${response ? html`<p>${named(ctx, response)}</p>` : ""}`,
  );
}

function limitations(ctx: Ctx): string[] {
  const { doc, pair, dict } = ctx;
  const list: string[] = [];
  doc.people.forEach((p, i) => {
    if (p.subject.timeCertainty === "unknown") list.push(pair.notes.timeUnknown(ctx.names[i]!));
    if (p.subject.timeCertainty === "approximate") list.push(pair.notes.timeApproximate(ctx.names[i]!, p.subject.windowMinutes ?? 0));
  });
  const extra = doc.interpretation.pair_synthesis.limitations;
  if (extra) list.push(named(ctx, extra));
  list.push(dict.limitations.general);
  return list;
}

export function renderPairReportBody(doc: PairReportDocument): RawHtml {
  const dict = getDictionary(doc.language);
  const pair = getPairDictionary(doc.language);
  const ctx: Ctx = { doc, dict, pair, names: [doc.people[0].subject.name, doc.people[1].subject.name] };
  const { pair_core: core, pair_dynamics: dyn, pair_synthesis: syn } = doc.interpretation;
  const banner = doc.kind === "sample" ? dict.notes.sampleBanner : doc.isDemo ? dict.notes.demoBanner : null;
  const title = `${pair.reportTitle} · ${pair.categories[doc.category]}`;

  return html`<article class="report pair-report" lang="${getLanguage(doc.language).htmlLang}">
    ${banner ? html`<p class="report-banner" role="note">${banner}</p>` : ""}
    <header class="report-cover">
      <p class="brand">Rasi Astro</p>
      <h1>${title}</h1>
      <p class="cover-name">${ctx.names[0]} <span class="amp">&amp;</span> ${ctx.names[1]}</p>
      <p class="cover-meta">${dict.labels.orderReference}: ${doc.orderReference} · ${dict.labels.generatedOn}: ${formatDate(doc.preparedOn, dict)} · ${
        doc.tradition === "indian" ? dict.sections.reportTitleIndian : dict.sections.reportTitleWestern
      }</p>
      <p class="cover-headline">${named(ctx, core.overview.headline)}</p>
    </header>
    ${section("overview", dict.sections.overview, paragraphs(ctx, core.overview.paragraphs))}
    ${section("two", pair.sections.theTwoOfYou, html`<div class="person-grid">${personCard(ctx, 0)}${personCard(ctx, 1)}</div>`)}
    ${section("charts", pair.sections.charts, doc.analysis.kind === "indian" ? indianCharts(ctx, doc.analysis) : westernCharts(ctx, doc.analysis))}
    ${factorsSection(ctx)}
    ${section(
      "factor-notes",
      pair.sections.factorNotes,
      join(core.factorExplanations.map((e) => html`<div class="explanation"><h3>${factorLabel(ctx, e.factorId)}</h3><p>${named(ctx, e.explanation)}</p></div>`)),
    )}
    ${join(
      ([
        [core.personA, 0],
        [core.personB, 1],
      ] as const).map(([p, i]) =>
        section(
          `person-${i === 0 ? "a" : "b"}`,
          pair.personSection(ctx.names[i]),
          html`<ul class="chips">${join(p.keyThemes.map((t) => html`<li>${named(ctx, t)}</li>`))}</ul>${paragraphs(ctx, p.paragraphs)}`,
        ),
      ),
    )}
    ${section("communication", pair.sections.communication, paragraphs(ctx, dyn.communication))}
    <div class="two-col">
      ${section(
        "strengths",
        pair.sections.sharedStrengths,
        html`${paragraphs(ctx, dyn.sharedStrengths.paragraphs)}<ul class="bullets">${join(dyn.sharedStrengths.points.map((x) => html`<li>${named(ctx, x)}</li>`))}</ul>`,
      )}
      ${section(
        "friction",
        pair.sections.potentialFriction,
        html`${paragraphs(ctx, dyn.potentialFriction.paragraphs)}<ul class="bullets">${join(dyn.potentialFriction.points.map((x) => html`<li>${named(ctx, x)}</li>`))}</ul>`,
      )}
    </div>
    ${section(
      "focus",
      pair.categories[doc.category],
      join(dyn.categoryFocus.sort((x, y) => x.themeNumber - y.themeNumber).map((t) => html`<article class="life-area"><h3>${named(ctx, t.title)}</h3>${paragraphs(ctx, t.paragraphs)}</article>`)),
    )}
    ${section("discuss", pair.sections.discussTogether, html`<ol class="discuss">${join(syn.discussTogether.map((q) => html`<li>${named(ctx, q)}</li>`))}</ol>`)}
    ${sharedSection(ctx) ?? ""}
    ${section("summary", pair.sections.summary, paragraphs(ctx, syn.summary))}
    ${section("limitations", pair.sections.limitations, html`<ul class="bullets">${join(limitations(ctx).map((l) => html`<li>${l}</li>`))}</ul>`)}
    ${section(
      "about",
      pair.sections.about,
      html`<p>${dict.disclaimer}</p>
        <p class="tech">${doc.calculation.provider} ${doc.calculation.calculationVersion} · ${doc.calculation.pairCalculationVersion} · ${doc.people[0].chart.conventions.ephemeris} · ${doc.interpretation.promptVersion} · ${doc.interpretation.provider}/${doc.interpretation.model} · ${doc.schemaVersion}</p>`,
    )}
  </article>`;
}

export const PAIR_REPORT_CSS = raw(`
.pair-report .amp { color: var(--r-gold-ink); font-style: italic; padding: 0 4px; }
.person-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.person-card { border: 1px solid var(--r-rule); border-radius: 10px; padding: 12px 14px; break-inside: avoid; }
.person-card h3 { margin: 0 0 8px; }
.person-a { border-top: 3px solid var(--pair-a); }
.person-b { border-top: 3px solid var(--pair-b); }
.person-card dl { margin: 0; font-size: 13.5px; }
.person-card dl div { display: grid; grid-template-columns: 42% 1fr; gap: 8px; padding: 4px 0; border-bottom: 1px dashed var(--r-rule); }
.person-card dt { color: var(--r-muted); }
.person-card dd { margin: 0; }
.pair-figure { margin-top: 14px; }
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 22px; }
.discuss { padding-left: 22px; }
.discuss li { margin-bottom: 8px; }
.el-chart { display: grid; gap: 10px; padding: 8px 4px; }
.el-row { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 8px; font-size: 12.5px; }
.el-bars { display: grid; gap: 3px; }
.el-bar { display: block; height: 14px; border-radius: 3px; min-width: 18px; position: relative; }
.el-bar b { position: absolute; right: 4px; top: -1px; font-size: 10px; color: #fff; }
.el-a { background: var(--pair-a); }
.el-b { background: var(--pair-b); }
.el-legend { font-size: 12px; color: var(--r-muted); text-align: center; }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin: 0 4px 0 10px; }
.dot-a { background: var(--pair-a); }
.dot-b { background: var(--pair-b); }
`);
