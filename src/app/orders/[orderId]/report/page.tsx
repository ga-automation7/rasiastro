import type { Metadata } from "next";
import { ReportView } from "@/components/report/ReportView";
import { NoAccess } from "@/components/status/NoAccess";
import { getDb } from "@/server/db";
import { hasOrderAccess } from "@/server/http";
import { isUuid } from "@/server/orders/repository";
import type { ReportDocument } from "@/server/reports/document";

export const metadata: Metadata = { title: "Your report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Reads the stored report - opening it never triggers a new AI call. */
export default async function ReportPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!isUuid(orderId) || !(await hasOrderAccess(orderId))) return <NoAccess />;
  const db = await getDb();
  const rows = await db.query<{ content: ReportDocument; pdf: boolean }>(
    `select r.content, (r.pdf_storage_key is not null) as pdf from reports r join orders o on o.id = r.order_id
      where r.order_id = $1::uuid and o.generation_status = 'ready'`,
    [orderId],
  );
  const report = rows[0];
  if (!report) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold text-night-900">Your report is not ready yet</h1>
        <p className="mt-4 text-muted">Please check the order page for progress.</p>
        <a className="btn btn-dark mt-6" href={`/orders/${orderId}`}>
          Back to order status
        </a>
      </div>
    );
  }
  return <ReportView doc={report.content} pdfHref={report.pdf ? `/api/orders/${orderId}/pdf` : null} backHref={`/orders/${orderId}`} backLabel="← Order status" />;
}
