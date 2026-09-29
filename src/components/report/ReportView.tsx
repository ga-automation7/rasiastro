import Link from "next/link";
import { isPairDocument, type AnyReportDocument } from "@/server/reports/pair-document";
import { PAIR_REPORT_CSS, renderPairReportBody } from "@/server/reports/pair-render";
import { PAIR_SVG_CSS } from "@/server/reports/pair-svg";
import { REPORT_CSS, renderReportBody } from "@/server/reports/render";

/**
 * Web view of a stored report (personal or compatibility). The markup comes from the
 * same renderer as the PDF, which escapes every piece of AI or customer text, so
 * injecting it here is safe. Opening it never triggers any AI call.
 */
export function ReportView({ doc, pdfHref, backHref, backLabel }: { doc: AnyReportDocument; pdfHref: string | null; backHref: string; backLabel: string }) {
  const pair = isPairDocument(doc);
  const body = (pair ? renderPairReportBody(doc) : renderReportBody(doc)).value;
  const css = `${REPORT_CSS.value}${pair ? `${PAIR_SVG_CSS.value}${PAIR_REPORT_CSS.value}` : ""}`;
  return (
    <div className="report-web mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <style>{css}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm font-semibold text-ink-700 underline underline-offset-2">
          {backLabel}
        </Link>
        {pdfHref ? (
          <a href={pdfHref} className="btn btn-dark min-h-10 px-4 py-2 text-sm">
            Download PDF
          </a>
        ) : null}
      </div>
      <div className="rounded-2xl bg-white px-5 py-6 shadow-sm ring-1 ring-ivory-300 sm:px-10 sm:py-10" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
