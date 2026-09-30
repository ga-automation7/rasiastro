/**
 * Development helper: drives a complete DEMO customer journey in a real browser
 * (local Chrome/Edge) against the running dev server, saving a screenshot per step.
 *
 * Usage (dev server running in demo mode):
 *   npx tsx scripts/lib/journey.ts personal [indian|western] [exact|approximate|unknown] [placeQuery] [ta|en|hi|te|kn|ml]
 *   npx tsx scripts/lib/journey.ts compatibility [indian|western] [category] [ta|en|hi|te|kn|ml]
 * (On Windows Git Bash, prefix with MSYS_NO_PATHCONV=1.)
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const [product = "personal", ...rest] = process.argv.slice(2);
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const width = Number(process.env.JOURNEY_WIDTH ?? 390);
const outDir = path.join(process.cwd(), ".data", "journey", product);
fs.rmSync(outDir, { recursive: true, force: true });
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

async function fillBirth(page: Page, opts: { nameLabel: string; name: string; day: string; month: string; year: string; certaintyName: string; certainty: string; place: string }) {
  await typeByLabel(page, opts.nameLabel, opts.name);
  await selectByLabel(page, "Day", opts.day);
  await selectByLabel(page, "Month", opts.month);
  await selectByLabel(page, "Year", opts.year);
  await page.click(`input[name="${opts.certaintyName}"][value=${opts.certainty}]`);
  if (opts.certainty !== "unknown") {
    await selectByLabel(page, "Hour", "6");
    await selectByLabel(page, "Minute", "30");
    await selectByLabel(page, "AM / PM", "AM");
    if (opts.certainty === "approximate") await selectByLabel(page, "How far off could it be?", "60");
  }
  await typeByLabel(page, "Birthplace (city or town)", opts.place);
  await page.waitForSelector("button.card", { timeout: 15_000 });
  await page.locator("button.card").click();
}

async function payAndOpen(page: Page) {
  await page.waitForSelector("::-p-text(DEMO CHECKOUT)", { timeout: 30_000 });
  await snap(page, "demo-checkout");
  await clickText(page, "Simulate successful payment");
  await page.waitForSelector("::-p-text(Your report is ready.)", { timeout: 180_000 });
  await snap(page, "status-ready");
  const orderUrl = page.url();
  await clickText(page, "Read my report");
  await page.waitForSelector(".report", { timeout: 30_000 });
  await snap(page, "report");
  const pdf = await page.evaluate(async (u) => {
    const id = new URL(u).pathname.split("/")[2];
    const res = await fetch(`/api/orders/${id}/pdf`);
    return { status: res.status, type: res.headers.get("content-type"), bytes: (await res.arrayBuffer()).byteLength };
  }, orderUrl);
  console.log("order page:", orderUrl);
  console.log("pdf:", JSON.stringify(pdf));
  return orderUrl;
}

const browser = await puppeteer.launch({ executablePath: findLocalBrowser()!, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 768, hasTouch: width < 768 });
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => void d.accept());
  let orderUrl: string;

  if (product === "compatibility") {
    const [tradition = "indian", category = "friendship", language = "en"] = rest;
    await page.goto(`${base}/compatibility?category=${category}`, { waitUntil: "networkidle0" });
    await page.click(`input[name=tradition][value=${tradition}]`);
    await page.click(`input[name=language][value=${language}]`);
    await snap(page, "step1");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Person A)");
    await fillBirth(page, { nameLabel: "Person A's full name", name: "Kavya Raman", day: "10", month: "3", year: "1991", certaintyName: "participants.0.birth.timeCertainty", certainty: "exact", place: "Chennai" });
    await typeByLabel(page, "Additional information about this person", "Likes to plan ahead and talk things through.");
    await snap(page, "step2");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Person B)");
    await fillBirth(page, { nameLabel: "Person B's full name", name: "Sam Okafor", day: "2", month: "11", year: "1989", certaintyName: "participants.1.birth.timeCertainty", certainty: "unknown", place: "New York" });
    await snap(page, "step3");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(About your connection)");
    await typeByLabel(page, "How do you know each other?", "University friends");
    await page.locator("button::-p-text(+ )").click();
    await snap(page, "step4");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Review your details)");
    await page.waitForSelector("dt::-p-text(Total to pay)", { timeout: 30_000 });
    await typeByLabel(page, "Email for your report", "demo.tester@example.com");
    await typeByLabel(page, "Mobile number", "9876543210");
    for (const box of await page.$$('input[type="checkbox"]')) await box.click();
    await snap(page, "step5-review");
    await page.locator("button[type=submit]").click();
    orderUrl = await payAndOpen(page);
  } else {
    const [tradition = "indian", certainty = "exact", placeQuery = "Madurai", language = "ta"] = rest;
    await page.goto(`${base}/start`, { waitUntil: "networkidle0" });
    await page.click(`input[name=tradition][value=${tradition}]`);
    await page.click(`input[name=language][value=${language}]`);
    await snap(page, "step1");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Your birth details)");
    await fillBirth(page, { nameLabel: "Full name of the person", name: "Demo Tester", day: "15", month: "8", year: "1990", certaintyName: "birth.timeCertainty", certainty, place: placeQuery });
    await snap(page, "step2");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Notes and questions)");
    await clickText(page, "Make it more personal.");
    const questions = await page.$$("textarea[placeholder^='For example']");
    const texts = ["What themes may shape my career in the next two years?", "How can I bring more patience to my relationships?", "What should I focus on for personal growth this year?"];
    for (let i = 0; i < 3; i += 1) await questions[i]!.type(texts[i]!);
    await snap(page, "step3");
    await clickText(page, "Continue");

    await page.waitForSelector("h1::-p-text(Review your details)");
    await page.waitForSelector("dt::-p-text(Total to pay)", { timeout: 20_000 });
    await typeByLabel(page, "Email for your report", "demo.tester@example.com");
    await typeByLabel(page, "Mobile number", "9876543210");
    for (const box of await page.$$('input[type="checkbox"]')) await box.click();
    await snap(page, "step4-review");
    await page.locator("button[type=submit]").click();
    orderUrl = await payAndOpen(page);
  }

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
