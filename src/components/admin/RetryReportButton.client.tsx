"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "../order/checkout";

/** Re-queues report generation for a paid order whose report failed. The customer is not charged again. */
export function RetryReportButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setMessage(null);
    const res = await postJson<{ ok: true }>(`/api/admin/orders/${orderId}/retry-report`);
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error.message);
      return;
    }
    setMessage("Report generation re-queued. Refresh in a few minutes to see progress.");
    router.refresh();
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-dark min-h-10 px-4 py-2 text-sm" onClick={() => void retry()} disabled={busy}>
        {busy ? "Re-queuing…" : "Retry report generation"}
      </button>
      {message ? (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
