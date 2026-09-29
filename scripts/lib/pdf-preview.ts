/**
 * Renders PDF pages to PNG images with Mozilla pdf.js running inside a local
 * Chrome/Edge. pdf.js draws the glyphs actually embedded in the PDF, so these images
 * show what customers will see - including whether Indic conjuncts and vowel signs
 * were shaped correctly when the PDF was produced.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { findLocalBrowser } from "../../src/server/reports/pdf";

const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build");

export async function renderPdfPages(pdf: Uint8Array, pages: number[], scale = 1.4): Promise<Buffer[]> {
  const executablePath = findLocalBrowser();
  if (!executablePath) throw new Error("No local Chrome/Edge found (set CHROME_EXECUTABLE_PATH)");
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-first-run"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 1500 });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // Everything is served from one fake origin, straight from memory/disk.
      const url = new URL(request.url());
      if (url.hostname !== "preview.local") {
        void request.abort();
      } else if (url.pathname.endsWith(".mjs")) {
        const file = path.join(PDFJS_DIR, path.basename(url.pathname));
        void request.respond({ status: 200, contentType: "text/javascript", body: fs.readFileSync(file) });
      } else if (url.pathname === "/report.pdf") {
        void request.respond({ status: 200, contentType: "application/pdf", body: Buffer.from(pdf) });
      } else if (url.pathname === "/") {
        void request.respond({ status: 200, contentType: "text/html", body: "<!doctype html><html><body style='margin:0;background:#888'></body></html>" });
      } else {
        void request.abort();
      }
    });
    await page.goto("https://preview.local/", { waitUntil: "load" });
    const count = await page.evaluate(async (wanted: number[], s: number) => {
      const pdfjs = await import("/pdf.mjs" as string);
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const doc = await pdfjs.getDocument({ url: "/report.pdf" }).promise;
      for (const n of wanted) {
        if (n > doc.numPages) continue;
        const p = await doc.getPage(n);
        const viewport = p.getViewport({ scale: s });
        const canvas = document.createElement("canvas");
        canvas.id = `page-${n}`;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";
        canvas.style.marginBottom = "10px";
        document.body.appendChild(canvas);
        await p.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
      }
      return doc.numPages as number;
    }, pages, scale);
    const images: Buffer[] = [];
    for (const n of pages) {
      if (n > count) continue;
      const element = await page.$(`#page-${n}`);
      if (element) images.push(Buffer.from(await element.screenshot({ type: "png" })));
    }
    return images;
  } finally {
    await browser.close();
  }
}
