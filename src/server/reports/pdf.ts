import fs from "node:fs";
import type { Browser } from "puppeteer-core";
import { getLanguage } from "@/config/languages";
import { getEnv } from "../config/env";
import { isPairDocument, type AnyReportDocument } from "./pair-document";
import { PAIR_REPORT_CSS, renderPairReportBody } from "./pair-render";
import { PAIR_SVG_CSS } from "./pair-svg";
import { REPORT_FONT_STACK, REPORT_HEADING_STACK, embeddedFontCss } from "./fonts";
import { html, raw } from "./html";
import { REPORT_CSS, renderReportBody } from "./render";

/**
 * PDF rendering with headless Chromium, chosen because Chromium (HarfBuzz) shapes
 * Tamil, Devanagari, Telugu, Kannada and Malayalam correctly - pure-JS PDF libraries
 * do not reliably handle conjuncts and vowel-sign reordering.
 *
 * Browser sources (PDF_BROWSER):
 * - serverless: @sparticuz/chromium (Vercel / AWS Lambda, Linux x64);
 * - local: an installed Chrome/Edge (development, scripts);
 * - remote: an existing browser via PDF_BROWSER_WS_ENDPOINT (e.g. a hosted browser service);
 * - auto (default): serverless when running on Vercel/Lambda, otherwise local.
 */
const PDF_PALETTE = `
  --r-ink: #1c1a2e; --r-heading: #1f1b4d; --r-muted: #6b6880; --r-muted-ink: #3d3a55; --r-rule: #e4dfd2;
  --r-gold: #b8862b; --r-gold-ink: #8a6219; --r-note-bg: #f7f3ea; --r-chip-bg: #efe9f8; --r-chip-ink: #3b2f73;
  --r-banner-bg: #fff4d6; --r-banner-ink: #6b4a00; --r-banner-line: #e6c66e;
  --chart-bg: #fffdf8; --chart-center: #f5f0e4; --chart-line: #b9a57a; --chart-ink: #1f1b4d; --chart-muted: #7a7466;
  --pair-a: #2b2f6b; --pair-a-soft: #dfe0f2; --pair-b: #b8862b; --pair-b-soft: #f6e8c8; --pair-b-ink: #8a6219; --pair-both: #e9dcc0;
  --pair-soft: #2f7d78; --pair-hard: #c2452d;
`;

export function buildPdfHtml(doc: AnyReportDocument): string {
  const pair = isPairDocument(doc);
  const body = pair ? renderPairReportBody(doc) : renderReportBody(doc);
  return html`<!doctype html>
<html lang="${getLanguage(doc.language).htmlLang}">
<head>
<meta charset="utf-8">
<title>Rasi Astro ${pair ? "compatibility report" : "report"} ${doc.orderReference}</title>
<style>${raw(embeddedFontCss())}</style>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  :root { ${raw(PDF_PALETTE)} --r-font: ${raw(REPORT_FONT_STACK)}; --r-heading-font: ${raw(REPORT_HEADING_STACK)}; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${REPORT_CSS}
  ${PAIR_SVG_CSS}
  ${PAIR_REPORT_CSS}
  .report { font-size: 11.5pt; }
  .report h1 { font-size: 24pt; }
  .report h2 { font-size: 16pt; }
  .report h3 { font-size: 12.5pt; }
  .report-table { font-size: 10pt; }
  .report-section { break-inside: auto; }
  .avoid-break { break-inside: avoid; }
</style>
</head>
<body>${body}</body>
</html>`.value;
}

const LOCAL_BROWSER_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findLocalBrowser(): string | null {
  const configured = getEnv().CHROME_EXECUTABLE_PATH;
  if (configured) return fs.existsSync(configured) ? configured : null;
  return LOCAL_BROWSER_CANDIDATES.find((p) => fs.existsSync(p)) ?? null;
}

function runningServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) && process.platform === "linux";
}

export type PdfBrowserSource = "serverless" | "local" | "remote";

export function resolveBrowserSource(): PdfBrowserSource {
  const choice = getEnv().PDF_BROWSER;
  if (choice !== "auto") return choice;
  return runningServerless() ? "serverless" : "local";
}

async function openBrowser(): Promise<{ browser: Browser; source: PdfBrowserSource; close: () => Promise<void> }> {
  const puppeteer = (await import("puppeteer-core")).default;
  const source = resolveBrowserSource();
  if (source === "remote") {
    const endpoint = getEnv().PDF_BROWSER_WS_ENDPOINT;
    if (!endpoint) throw new Error("PDF_BROWSER=remote requires PDF_BROWSER_WS_ENDPOINT");
    const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    return { browser, source, close: () => browser.disconnect() };
  }
  if (source === "serverless") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
    return { browser, source, close: () => browser.close() };
  }
  const executablePath = findLocalBrowser();
  if (!executablePath) {
    throw new Error("No Chrome/Edge found for PDF rendering. Install Google Chrome or set CHROME_EXECUTABLE_PATH.");
  }
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-first-run", "--disable-extensions"] });
  return { browser, source, close: () => browser.close() };
}

type PdfRenderer = (doc: AnyReportDocument) => Promise<{ pdf: Uint8Array; renderer: string }>;
let rendererOverride: PdfRenderer | null = null;
/** Tests that are not about the PDF itself can skip launching a browser. */
export function setPdfRendererForTests(renderer: PdfRenderer | null): void {
  rendererOverride = renderer;
}

export async function renderPdf(doc: AnyReportDocument): Promise<{ pdf: Uint8Array; renderer: string }> {
  if (rendererOverride) return rendererOverride(doc);
  const content = buildPdfHtml(doc);
  const { browser, source, close } = await openBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45_000);
    // The document is self-contained (fonts embedded, no scripts): any attempt to
    // load something from the network is refused.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:") || request.url() === "about:blank") void request.continue();
      else void request.abort();
    });
    await page.setContent(content, { waitUntil: "load" });
    const pdf = await page.pdf({
      waitForFonts: true,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="width:100%;font-size:7.5px;color:#8a8598;text-align:center;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.02em;">rasiastro.com · ${doc.orderReference} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
      tagged: true,
    });
    return { pdf, renderer: `chromium-${source}-${await browser.version()}` };
  } finally {
    await close();
  }
}
