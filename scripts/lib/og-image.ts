/**
 * Development helper: renders the social preview image (1200 x 630) with the site's
 * own fonts and colours, using local Chrome/Edge. Output: public/art/og-card.jpg.
 * Deliberately shows no price, so the image never goes stale when prices change.
 *
 * Usage: npx tsx scripts/lib/og-image.ts
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const font = (file: string) => `data:font/woff2;base64,${fs.readFileSync(path.join(process.cwd(), "src/assets/fonts", file)).toString("base64")}`;

const ticks = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  return `<line x1="${300 + 232 * Math.cos(a)}" y1="${300 + 232 * Math.sin(a)}" x2="${300 + 270 * Math.cos(a)}" y2="${300 + 270 * Math.sin(a)}"/>`;
}).join("");
const stars = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 197.3) % 1200;
  const y = (i * 83.7 + (i % 7) * 41) % 630;
  const r = i % 9 === 0 ? 1.6 : i % 3 === 0 ? 1.1 : 0.7;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#f7ecd2" opacity="${(0.25 + (i % 5) * 0.12).toFixed(2)}"/>`;
}).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Fraunces; src: url(${font("display-fraunces.woff2")}) format("woff2"); font-weight: 100 900; }
@font-face { font-family: Noto; src: url(${font("noto-sans-latin-400-normal.woff2")}) format("woff2"); font-weight: 400; }
@font-face { font-family: Noto; src: url(${font("noto-sans-latin-600-normal.woff2")}) format("woff2"); font-weight: 600; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: radial-gradient(ellipse 60% 70% at 78% 45%, rgb(40 51 108 / .6), transparent 70%), linear-gradient(180deg, #070c17, #0a1523); font-family: Noto, sans-serif; color: #f8f1e3; position: relative; }
.sky { position: absolute; inset: 0; }
.wheel { position: absolute; right: -40px; top: 15px; width: 600px; height: 600px; }
.copy { position: absolute; left: 80px; top: 92px; width: 640px; }
.brand { display: flex; align-items: center; gap: 14px; font-family: Fraunces, serif; font-size: 34px; font-weight: 560; letter-spacing: -0.01em; }
.eyebrow { margin-top: 64px; font-size: 17px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #e3c486; }
h1 { margin-top: 22px; font-family: Fraunces, serif; font-weight: 560; font-size: 84px; line-height: 1.02; letter-spacing: -0.02em; font-variation-settings: "opsz" 144; }
h1 span { display: block; color: #f0dcaa; }
.foot { position: absolute; left: 80px; bottom: 64px; font-size: 21px; color: #d9cfbd; }
.foot b { color: #e3c486; font-weight: 600; }
</style></head><body>
<svg class="sky" viewBox="0 0 1200 630">${stars}</svg>
<svg class="wheel" viewBox="0 0 600 600" fill="none" stroke="#cfa45a" stroke-opacity=".55" stroke-width="1.2">
  <circle cx="300" cy="300" r="270"/><circle cx="300" cy="300" r="232"/>
  <circle cx="300" cy="300" r="170" stroke-dasharray="2 7"/>${ticks}
  <g stroke-opacity=".7"><rect x="220" y="220" width="160" height="160"/><path d="M220 260h160M220 340h160M260 220v160M340 220v160M220 300h40M340 300h40M300 220v40M300 340v40"/></g>
  <path d="M300 280l5 15 15 5-15 5-5 15-5-15-15-5 15-5z" fill="#e3c486" stroke="none"/>
  <circle cx="300" cy="30" r="5" fill="#e3c486" stroke="none"/><circle cx="68" cy="300" r="3.5" fill="#e3c486" stroke="none"/>
</svg>
<div class="copy">
  <div class="brand"><svg width="30" height="30" viewBox="0 0 16 16"><path fill="#cfa45a" d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z"/></svg>Rasi Astro</div>
  <p class="eyebrow">Personal astrology reports</p>
  <h1>Your birth chart.<span>Decoded for you.</span></h1>
</div>
<p class="foot"><b>Indian and Western astrology</b> · Six languages · Web report and PDF</p>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: findLocalBrowser() ?? undefined, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(process.cwd(), "public", "art", "og-card.jpg");
  await page.screenshot({ path: out, type: "jpeg", quality: 88 });
  console.log(`wrote ${out} (${fs.statSync(out).size} bytes)`);
} finally {
  await browser.close();
}
