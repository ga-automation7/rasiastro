import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ReportView } from "@/components/report/ReportView";
import { buildSampleReport } from "@/server/reports/sample";

export const metadata: Metadata = {
  title: "Sample report",
  description: "A complete sample Rasi Astro report for a fictional person, with a genuinely calculated chart and illustrative text.",
};

export default async function SampleReportPage() {
  const doc = await buildSampleReport();
  const pdfPath = path.join(process.cwd(), "public", "samples", "rasi-astro-sample-report-en.pdf");
  const hasPdf = fs.existsSync(pdfPath);
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <p className="eyebrow">Sample report</p>
        <h1 className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">What a Rasi Astro report looks like</h1>
        <p className="mt-3 text-muted">
          This is a complete Indian (Vedic) report in English for a <strong>fictional person</strong>. The chart is calculated from the sample birth details exactly as for a real order; the interpretive
          text was written by hand to illustrate the style. Your report is written for your own chart, in the language you choose.
        </p>
        <Link href="/start" className="btn btn-primary mt-5">
          Get your own report
        </Link>
      </div>
      <ReportView doc={doc} pdfHref={hasPdf ? "/samples/rasi-astro-sample-report-en.pdf" : null} backHref="/" backLabel="← Home" />
    </>
  );
}
