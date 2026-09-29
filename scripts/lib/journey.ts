/**
 * Development helper: drives the complete DEMO customer journey in a real browser
 * (local Chrome/Edge) against the running dev server, saving a screenshot per step.
 *
 * Usage (dev server running in demo mode):
 *   npx tsx scripts/lib/journey.ts [indian|western] [exact|approximate|unknown] [placeQuery] [ta|en|hi|te|kn|ml]
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const [tradition = "indian", certainty = "exact", placeQuery = "Madurai", language = "ta"] = process.argv.slice(2);
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const width = Number(process.env.JOURNEY_WIDTH ?? 390);
const outDir = path.join(process.cwd(), ".data", "journey");
fs.mkdirSync(outDir, { recursive: true });
let shot = 0;
const errors: string[] = [];

async function snap(page: Page, label: string) {
  shot += 1;
  await page.screenshot({ path: path.join(outDir, `${String(shot).padStart(2, "0")}-${label}.png`), fullPage: true });
}

async function clickText(page: Page, text: string) {
  await page.locator(`::-p-text(${text})`).click();
}

async function selectByLabel(page: Page, label: string, value: string) {
  const id = await page.evaluate((l) => {
    const el = [...document.querySelectorAll("label")].find((x) => x.textContent?.trim() === l);
    return el?.getAttribute("for") ?? null;
  }, label);
  if (!id) throw new Error(`No label ${label}`);
  await page.select(`[id="${id}"]`, value);
}

async function typeByLabel(page: Page, label: string, value: string) {
  const id = await page.evaluate((l) => [...document.querySelectorAll("label")].find((x) => x.textContent?.trim().startsWith(l))?.getAttribute("for") ?? null, label);
  if (!id) throw new Error(`No label ${label}`);
  await page.type(`[id="${id}"]`, value);
}

const browser = await puppeteer.launch({ executablePath: findLocalBrowser()!, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 768, hasTouch: width < 768 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => void d.accept());

  await page.goto(`${base}/start`, { waitUntil: "networkidle0" });
  await page.click(`input[name=tradition][value=${tradition}]`);
  await page.click(`input[name=language][value=${language}]`);
  await snap(page, "step1");
  await clickText(page, "Continue");

  await page.waitForSelector("h1::-p-text(Birth details)");
  await typeByLabel(page, "Full name of the person", "Demo Tester");
  await selectByLabel(page, "Day", "15");
  await selectByLabel(page, "Month", "8");
  await selectByLabel(page, "Year", "1990");
  await page.click(`input[name=timeCertainty][value=${certainty}]`);
  if (certainty !== "unknown") {
    await selectByLabel(page, "Hour", "6");
    await selectByLabel(page, "Minute", "30");
    await selectByLabel(page, "AM / PM", "AM");
    if (certainty === "approximate") await selectByLabel(page, "How far off could it be?", "60");
  }
  await typeByLabel(page, "Birthplace (city or town)", placeQuery);
  await page.waitForSelector("button.card", { timeout: 15_000 });
  await snap(page, "step2-place-results");
  await page.locator("button.card").click();
  await snap(page, "step2");
  await clickText(page, "Continue");

  await page.waitForSelector("h1::-p-text(Context & questions)");
  await clickText(page, "Add three personal questions");
  const questions = await page.$$("textarea[placeholder]");
  const texts = ["What themes may shape my career in the next two years?", "How can I bring more patience to my relationships?", "What should I focus on for personal growth this year?"];
  for (let i = 0; i < 3; i += 1) await questions[i]!.type(texts[i]!);
  await snap(page, "step3");
  await clickText(page, "Continue");

  await page.waitForSelector("h1::-p-text(Review & pay)");
  await page.waitForSelector("dt::-p-text(Total to pay)", { timeout: 20_000 });
  await typeByLabel(page, "Email for your report", "demo.tester@example.com");
  await typeByLabel(page, "Mobile number", "9876543210");
  await page.click('input[type="checkbox"]');
  await snap(page, "step4-review");
  await page.locator("button[type=submit]").click();

  await page.waitForSelector("::-p-text(DEMO CHECKOUT)", { timeout: 30_000 });
  await snap(page, "demo-checkout");
  await clickText(page, "Simulate successful payment");

  await page.waitForSelector("::-p-text(Your report is ready.)", { timeout: 120_000 });
  await snap(page, "status-ready");
  const orderUrl = page.url();
  await clickText(page, "Read your report");
  await page.waitForSelector(".report", { timeout: 30_000 });
  await snap(page, "report");
  const pdf = await page.evaluate(async (u) => {
    const id = new URL(u).pathname.split("/")[2];
    const res = await fetch(`/api/orders/${id}/pdf`);
    return { status: res.status, type: res.headers.get("content-type"), bytes: (await res.arrayBuffer()).byteLength };
  }, orderUrl);
  console.log("order page:", orderUrl);
  console.log("pdf:", JSON.stringify(pdf));

  // A second, fresh browser context must NOT be able to open the order.
  const other = await browser.createBrowserContext();
  const stranger = await other.newPage();
  await stranger.goto(orderUrl, { waitUntil: "networkidle0" });
  const strangerText = await stranger.evaluate(() => document.body.innerText);
  console.log("stranger sees report:", /Your report is ready/.test(strangerText) ? "YES (BUG)" : "no");
  const strangerPdf = await stranger.evaluate(async (u) => (await fetch(`/api/orders/${new URL(u).pathname.split("/")[2]}/pdf`)).status, orderUrl);
  console.log("stranger pdf status:", strangerPdf);
  await other.close();
} finally {
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
}
