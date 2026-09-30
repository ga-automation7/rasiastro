/**
 * Development helper: full-page screenshots of the running dev server, using the
 * locally installed Chrome/Edge. Reports console errors and horizontal overflow (a
 * common mobile layout bug) for every page and width.
 *
 * Usage:
 *   npx tsx scripts/lib/screenshots.ts /path1 /path2 ... [--widths=360,390,768,1440] [--reduced-motion] [--no-js]
 *
 * The page is scrolled once before capture so scroll reveals have run. With
 * --reduced-motion the prefers-reduced-motion media feature is emulated.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const outDir = path.join(process.cwd(), ".data", "screens");
fs.mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const widthsArg = args.find((a) => a.startsWith("--widths="));
const widths = widthsArg ? widthsArg.slice(9).split(",").map(Number) : [390, 1440];
const reducedMotion = args.includes("--reduced-motion");
const noJs = args.includes("--no-js");
const paths = args.filter((a) => !a.startsWith("--"));

const executablePath = findLocalBrowser();
if (!executablePath) throw new Error("No local Chrome/Edge found");
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  for (const width of widths) {
    for (const p of paths.length ? paths : ["/"]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: width < 768 ? 800 : 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
      if (reducedMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      if (noJs) await page.setJavaScriptEnabled(false);
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${base}${p}`, { waitUntil: "networkidle0", timeout: 120_000 });
      const stemBase = `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}`;
      if (noJs) {
        // Page scripts are off, so nothing can be evaluated: one full-page capture.
        await page.screenshot({ path: path.join(outDir, `${stemBase}-nojs.png`), fullPage: true });
        console.log(`${stemBase}-nojs: captured (JavaScript disabled) errors=${errors.length ? errors.join(" | ") : "none"}`);
        await page.close();
        continue;
      }
      // Trigger scroll reveals, then return to the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await new Promise((r) => setTimeout(r, 900));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const stem = `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}${reducedMotion ? "-rm" : ""}${noJs ? "-nojs" : ""}`;
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const segment = width < 768 ? 1400 : 1100;
      for (let y = 0, i = 1; y < height && i <= 14; y += segment, i += 1) {
        await page.screenshot({ path: path.join(outDir, `${stem}-${i}.png`), clip: { x: 0, y, width, height: Math.min(segment, height - y) }, captureBeyondViewport: true });
      }
      console.log(`${stem}: height=${height}px overflowX=${overflow}px errors=${errors.length ? errors.join(" | ") : "none"}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
