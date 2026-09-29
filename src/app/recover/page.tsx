import type { Metadata } from "next";
import { RecoverForm } from "@/components/access/RecoverForm.client";

export const metadata: Metadata = { title: "Find my report", robots: { index: false, follow: false } };

export default function RecoverPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <p className="eyebrow">No account needed</p>
      <h1 className="mt-2 text-3xl font-semibold text-night-900">Find my report</h1>
      <p className="mt-3 text-muted">
        Enter the email address you used when ordering. If it matches a paid order, we will email you fresh secure links. For privacy we show the same message either way.
      </p>
      <div className="mt-8">
        <RecoverForm />
      </div>
    </div>
  );
}
