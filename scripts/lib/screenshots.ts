/**
 * Development helper: full-page screenshots of the running dev server at phone and
 * desktop widths, using the locally installed Chrome/Edge. Also reports console
 * errors and horizontal overflow (a common mobile layout bug).
 *
 * Usage: npx tsx scripts/lib/screenshots.ts /path1 /path2 ...
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const outDir = path.join(process.cwd(), ".data", "screens");
fs.mkdirSync(outDir, { recursive: true });

const executablePath = findLocalBrowser();
if (!executablePath) throw new Error("No local Chrome/Edge found");
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
  for (const width of [390, 1280]) {
    for (const p of paths) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`${base}${p}`, { waitUntil: "networkidle0", timeout: 90_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const stem = `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}`;
      // Split long pages into readable segments.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const segment = width < 768 ? 1400 : 1100;
      for (let y = 0, i = 1; y < height && i <= 12; y += segment, i += 1) {
        await page.screenshot({ path: path.join(outDir, `${stem}-${i}.png`), clip: { x: 0, y, width, height: Math.min(segment, height - y) }, captureBeyondViewport: true });
      }
      console.log(`${stem}: height=${height}px overflowX=${overflow}px errors=${errors.length ? errors.join(" | ") : "none"}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
