import Link from "next/link";
import type { ReportDocument } from "@/server/reports/document";
import { REPORT_CSS, renderReportBody } from "@/server/reports/render";

/**
 * Web view of a stored report. The markup comes from the same renderer as the PDF,
 * which escapes every piece of AI or customer text, so injecting it here is safe.
 */
export function ReportView({ doc, pdfHref, backHref, backLabel }: { doc: ReportDocument; pdfHref: string | null; backHref: string; backLabel: string }) {
  const body = renderReportBody(doc).value;
  return (
    <div className="report-web mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <style>{REPORT_CSS.value}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm font-semibold text-night-700 underline">
          {backLabel}
        </Link>
        {pdfHref ? (
          <a href={pdfHref} className="btn btn-dark px-4 py-2 text-sm">
            Download PDF
          </a>
        ) : null}
      </div>
      <div className="rounded-2xl bg-white px-5 py-6 shadow-sm ring-1 ring-ivory-300 sm:px-10 sm:py-10" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
