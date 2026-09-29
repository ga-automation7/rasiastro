"use client";

import Link from "next/link";
import { useId } from "react";
import { REPORT_LANGUAGES, TRADITIONS } from "@/config/languages";
import { NAKSHATRA_NAMES_EN, SIGN_NAMES_EN } from "@/domain/astrology/constants";
import { formatInr } from "@/domain/pricing";
import { FieldShell, describedBy } from "./fields";
import { MONTHS, placeLabel, time24, type StepId, type WizardState } from "./wizard-state";

export interface PreviewResult {
  quote: { lines: { code: string; label: string; amountPaise: number }[]; totalAmountPaise: number };
  totalLabel: string;
  birth: { placeLabel: string; timeZoneId: string; utcOffsetLabel: string; localTimeLabel: string } | null;
  dstOverlap: { earlierOffsetLabel: string; laterOffsetLabel: string } | null;
}

function Row({ label, children, step, onEdit }: { label: string; children: React.ReactNode; step: StepId; onEdit: (s: StepId) => void }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ivory-300 py-3 sm:flex-row sm:items-start sm:justify-between">
      <dt className="text-sm font-semibold text-muted sm:w-48">{label}</dt>
      <dd className="flex-1 text-night-900">{children}</dd>
      <button type="button" className="self-start text-sm font-semibold text-night-700 underline" onClick={() => onEdit(step)}>
        Edit<span className="sr-only"> {label}</span>
      </button>
    </div>
  );
}

export function StepReview({
  state,
  preview,
  previewLoading,
  onChange,
  onEdit,
  errors,
}: {
  state: WizardState;
  preview: PreviewResult | null;
  previewLoading: boolean;
  onChange: (patch: Partial<WizardState>) => void;
  onEdit: (step: StepId) => void;
  errors: Record<string, string>;
}) {
  const emailId = useId();
  const phoneId = useId();
  const tradition = TRADITIONS.find((t) => t.code === state.tradition);
  const language = REPORT_LANGUAGES.find((l) => l.code === state.language);
  const t24 = time24(state);
  const dateLabel = state.day && state.month && state.year ? `${state.day} ${MONTHS[Number(state.month) - 1]} ${state.year}` : "-";
  const timeLabel =
    state.timeCertainty === "unknown"
      ? "Not known"
      : `${state.hour12}:${state.minute} ${state.meridiem} (${t24})${state.timeCertainty === "approximate" ? ` · approximate, ± ${state.timeWindowMinutes} min` : " · exact"}`;
  const known = [
    state.known.moonSign ? `Moon sign: ${SIGN_NAMES_EN[state.known.moonSign].western}` : null,
    state.known.nakshatra ? `Nakshatra: ${NAKSHATRA_NAMES_EN[state.known.nakshatra]}${state.known.pada ? ` pada ${state.known.pada}` : ""}` : null,
    state.known.ascendant ? `Ascendant: ${SIGN_NAMES_EN[state.known.ascendant].western}` : null,
    state.known.otherDetails ? "Other details added" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <dl className="card px-5">
        <Row label="Tradition" step={1} onEdit={onEdit}>
          {tradition?.title ?? "-"}
        </Row>
        <Row label="Report language" step={1} onEdit={onEdit}>
          {language ? <span lang={language.htmlLang}>{language.nativeName}</span> : "-"}
        </Row>
        <Row label="Report for" step={2} onEdit={onEdit}>
          {state.subjectName || "-"}
        </Row>
        <Row label="Date of birth" step={2} onEdit={onEdit}>
          {dateLabel}
        </Row>
        <Row label="Time of birth" step={2} onEdit={onEdit}>
          {timeLabel}
        </Row>
        <Row label="Birthplace" step={2} onEdit={onEdit}>
          {state.place ? placeLabel(state.place) : "-"}
          {preview?.birth ? (
            <span className="mt-1 block text-sm text-muted">
              Time zone at birth: {preview.birth.timeZoneId}, {preview.birth.utcOffsetLabel}
            </span>
          ) : null}
        </Row>
        <Row label="Your chart details & notes" step={3} onEdit={onEdit}>
          {known.length || state.additionalContext ? [...known, state.additionalContext ? "Notes added" : null].filter(Boolean).join(" · ") : "None"}
        </Row>
        <Row label="Questions" step={3} onEdit={onEdit}>
          {state.includeQuestions ? "3 questions (+₹20)" : "No question add-on"}
        </Row>
      </dl>

      {preview?.dstOverlap ? (
        <fieldset className="rounded-xl border border-gold-400 bg-gold-200/30 p-4">
          <legend className="px-1 font-semibold text-night-900">This birth time happened twice</legend>
          <p className="text-sm">
            On that date the clocks at the birthplace went back, so {t24} occurred twice. Please choose which one (a birth certificate or parent may know):
          </p>
          <div className="mt-3 space-y-2">
            {(["earlier", "later"] as const).map((choice) => (
              <label key={choice} className="flex items-center gap-2">
                <input type="radio" name="dst" checked={state.dstChoice === choice} onChange={() => onChange({ dstChoice: choice })} className="h-4 w-4 accent-night-800" />
                The {choice} one ({choice === "earlier" ? preview.dstOverlap!.earlierOffsetLabel : preview.dstOverlap!.laterOffsetLabel})
              </label>
            ))}
          </div>
          {errors["birth.dstChoice"] ? <p className="field-error">{errors["birth.dstChoice"]}</p> : null}
        </fieldset>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Email for your report" htmlFor={emailId} error={errors.email} hint="We send the secure report link here. Nothing else - no newsletters.">
          <input
            id={emailId}
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={state.email}
            onChange={(e) => onChange({ email: e.target.value })}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy(emailId, true, errors.email)}
          />
        </FieldShell>
        <FieldShell
          label="Mobile number (for payment)"
          htmlFor={phoneId}
          error={errors.phone}
          hint="Required by our payment partner Cashfree to process the payment. We don't call, text or market to it."
        >
          <input
            id={phoneId}
            className="input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="10-digit mobile, or +country code"
            value={state.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy(phoneId, true, errors.phone)}
          />
        </FieldShell>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-semibold text-night-900">Price</h3>
        {previewLoading && !preview ? <p className="mt-2 text-sm text-muted">Checking your details…</p> : null}
        {preview ? (
          <dl className="mt-3 space-y-2">
            {preview.quote.lines.map((line) => (
              <div key={line.code} className="flex justify-between gap-4 text-[15px]">
                <dt>{line.label}</dt>
                <dd className="font-semibold">{formatInr(line.amountPaise)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-ivory-300 pt-2 text-lg">
              <dt className="font-semibold">Total to pay</dt>
              <dd className="font-semibold text-night-900">{preview.totalLabel}</dd>
            </div>
          </dl>
        ) : null}
        <p className="mt-3 text-sm text-muted">One-time payment in Indian rupees. PDF included. No other charges.</p>
      </div>

      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-night-800" checked={state.consent} onChange={(e) => onChange({ consent: e.target.checked })} aria-invalid={Boolean(errors.consentProcessing)} />
        <span className="text-[15px]">
          I agree that Rasi Astro may use these details to calculate, write and deliver this report, as described in the{" "}
          <Link href="/privacy" className="underline" target="_blank">
            privacy policy
          </Link>
          , and I accept the{" "}
          <Link href="/terms" className="underline" target="_blank">
            terms
          </Link>
          . If the report is about someone else, I have their permission to share their birth details.
        </span>
      </label>
      {errors.consentProcessing ? (
        <p className="field-error" role="alert">
          {errors.consentProcessing}
        </p>
      ) : null}
      <p className="text-sm text-muted">
        After you pay, the details above are locked for this order. To change them later you would place a new order, so please check them now.
      </p>
    </div>
  );
}
