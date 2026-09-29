/**
 * Regenerates the downloadable sample report PDF shown on /sample-report.
 *   npm run samples:build
 * Output: public/samples/rasi-astro-sample-report-en.pdf (committed to the repository).
 */
import fs from "node:fs";
import path from "node:path";
import { fail } from "./lib/cli";
import { renderPdf } from "../src/server/reports/pdf";
import { buildSampleReport } from "../src/server/reports/sample";

try {
  const { pdf } = await renderPdf(await buildSampleReport());
  const out = path.join("public", "samples", "rasi-astro-sample-report-en.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pdf);
  console.log(`✓ Wrote ${out} (${Math.round(pdf.byteLength / 1024)} KB)`);
} catch (error) {
  fail((error as Error).message);
}
