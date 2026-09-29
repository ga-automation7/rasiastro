"use client";

import Link from "next/link";
import { useId } from "react";
import { formatInr } from "@/domain/pricing";
import { FieldShell, describedBy } from "./fields";

export interface QuoteView {
  lines: { code: string; label: string; amountPaise: number }[];
  totalAmountPaise: number;
}

/** Email, mobile and the required confirmations, shared by both order forms. */
export function CheckoutDetails({
  email,
  phone,
  consent,
  adult,
  permission,
  onChange,
  errors,
  aboutSomeoneElseNote,
}: {
  email: string;
  phone: string;
  consent: boolean;
  adult: boolean;
  /** Compatibility only: permission to share the other person's details. */
  permission?: boolean;
  onChange: (patch: { email?: string; phone?: string; consent?: boolean; adult?: boolean; permission?: boolean }) => void;
  errors: Record<string, string>;
  aboutSomeoneElseNote: boolean;
}) {
  const emailId = useId();
  const phoneId = useId();
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Email for your report" htmlFor={emailId} error={errors.email} hint="We send your private report link here. No newsletters or marketing.">
          <input
            id={emailId}
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy(emailId, true, errors.email)}
          />
        </FieldShell>
        <FieldShell label="Mobile number (for payment)" htmlFor={phoneId} error={errors.phone} hint="Our payment partner, Cashfree Payments, requires it. We don't call, message or market to it.">
          <input
            id={phoneId}
            className="input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="10-digit mobile, or + country code"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy(phoneId, true, errors.phone)}
          />
        </FieldShell>
      </div>

      <div className="space-y-4 rounded-xl border border-ivory-300 bg-ivory-50 p-5">
        <Check checked={consent} onChange={(v) => onChange({ consent: v })} error={errors.consentProcessing}>
          I agree that Rasi Astro may use these details to calculate, write and deliver this report as described in the{" "}
          <Link href="/privacy" className="underline underline-offset-2" target="_blank">
            Privacy Policy
          </Link>
          , and I accept the{" "}
          <Link href="/terms" className="underline underline-offset-2" target="_blank">
            Terms of Service
          </Link>
          .{aboutSomeoneElseNote ? " If this report is about someone else, I have their permission to share their birth details." : ""}
        </Check>
        <Check checked={adult} onChange={(v) => onChange({ adult: v })} error={errors.adultConfirmed}>
          I am 18 or older{permission !== undefined ? ", and so is the other person" : aboutSomeoneElseNote ? ", and so is the person this report is about" : ""}.
        </Check>
        {permission !== undefined ? (
          <Check checked={permission} onChange={(v) => onChange({ permission: v })} error={errors.thirdPartyPermission}>
            I have the other person&apos;s permission to share their birth details and the notes I add about them for this report.
          </Check>
        ) : null}
      </div>
    </div>
  );
}

function Check({ checked, onChange, error, children }: { checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-ink-800"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="text-[15px] leading-relaxed">{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="field-error ml-8" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PriceSummary({ quote, totalLabel, loading }: { quote: QuoteView | null; totalLabel: string | null; loading: boolean }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-ink-900">Price</h3>
      {loading && !quote ? <p className="mt-2 text-sm text-muted">Checking your details…</p> : null}
      {quote ? (
        <dl className="mt-3 space-y-2">
          {quote.lines.map((line) => (
            <div key={line.code} className="flex justify-between gap-4 text-[15px]">
              <dt>{line.label}</dt>
              <dd className="font-semibold">{formatInr(line.amountPaise)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-ivory-300 pt-2 text-lg">
            <dt className="font-semibold">Total to pay</dt>
            <dd className="font-semibold text-ink-900">{totalLabel}</dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-3 text-sm text-muted">One-time payment in Indian rupees. Online report and PDF included. No account and no subscription.</p>
    </div>
  );
}
