"use client";

import { REPORT_LANGUAGES, TRADITIONS } from "@/config/languages";
import { NAKSHATRA_NAMES_EN, SIGN_NAMES_EN } from "@/domain/astrology/constants";
import { PRICE } from "@/content/site-copy";
import { CheckoutDetails, PriceSummary, type QuoteView } from "./CheckoutDetails.client";
import { dateLabel, placeLabel, time24, timeLabel } from "./person";
import type { StepId, WizardState } from "./wizard-state";

export interface PreviewResult {
  quote: QuoteView;
  totalLabel: string;
  birth: { placeLabel: string; timeZoneId: string; utcOffsetLabel: string; localTimeLabel: string } | null;
  dstOverlap: { earlierOffsetLabel: string; laterOffsetLabel: string } | null;
}

export function ReviewRow({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ivory-300 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <dt className="text-sm font-semibold text-muted sm:w-48">{label}</dt>
      <dd className="flex-1 break-words text-ink-900">{children}</dd>
      {onEdit ? (
        <button type="button" className="self-start text-sm font-semibold text-ink-700 underline underline-offset-2" onClick={onEdit}>
          Edit<span className="sr-only"> {label}</span>
        </button>
      ) : null}
    </div>
  );
}

export function DstChoice({
  time,
  overlap,
  value,
  onChange,
  error,
  name,
}: {
  time: string | null;
  overlap: { earlierOffsetLabel: string; laterOffsetLabel: string };
  value: "earlier" | "later" | null;
  onChange: (v: "earlier" | "later") => void;
  error?: string;
  name: string;
}) {
  return (
    <fieldset className="rounded-xl border border-gold-400 bg-gold-100 p-4">
      <legend className="px-1 font-semibold text-ink-900">This birth time happened twice</legend>
      <p className="text-sm">On that date the clocks at the birthplace went back, so {time} happened twice. Please choose which one (a birth certificate or a parent may know):</p>
      <div className="mt-3 space-y-2">
        {(["earlier", "later"] as const).map((choice) => (
          <label key={choice} className="flex items-center gap-2">
            <input type="radio" name={name} checked={value === choice} onChange={() => onChange(choice)} className="h-4 w-4 accent-ink-800" />
            The {choice} one ({choice === "earlier" ? overlap.earlierOffsetLabel : overlap.laterOffsetLabel})
          </label>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </fieldset>
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
  const tradition = TRADITIONS.find((t) => t.code === state.tradition);
  const language = REPORT_LANGUAGES.find((l) => l.code === state.language);
  const known = [
    state.known.moonSign ? `Moon sign: ${SIGN_NAMES_EN[state.known.moonSign].western}` : null,
    state.known.nakshatra ? `Nakshatra: ${NAKSHATRA_NAMES_EN[state.known.nakshatra]}${state.known.pada ? ` pada ${state.known.pada}` : ""}` : null,
    state.known.ascendant ? `Ascendant: ${SIGN_NAMES_EN[state.known.ascendant].western}` : null,
    state.known.otherDetails ? "Other details added" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <dl className="card px-5">
        <ReviewRow label="Tradition" onEdit={() => onEdit(1)}>
          {tradition?.title ?? "-"}
        </ReviewRow>
        <ReviewRow label="Report language" onEdit={() => onEdit(1)}>
          {language ? <span lang={language.htmlLang}>{language.nativeName}</span> : "-"}
        </ReviewRow>
        <ReviewRow label="Report for" onEdit={() => onEdit(2)}>
          {state.subjectName || "-"}
        </ReviewRow>
        <ReviewRow label="Date of birth" onEdit={() => onEdit(2)}>
          {dateLabel(state)}
        </ReviewRow>
        <ReviewRow label="Time of birth" onEdit={() => onEdit(2)}>
          {timeLabel(state)}
        </ReviewRow>
        <ReviewRow label="Birthplace" onEdit={() => onEdit(2)}>
          {state.place ? placeLabel(state.place) : "-"}
          {preview?.birth ? (
            <span className="mt-1 block text-sm text-muted">
              Time zone at birth: {preview.birth.timeZoneId}, {preview.birth.utcOffsetLabel}
            </span>
          ) : null}
        </ReviewRow>
        <ReviewRow label="Your chart details and notes" onEdit={() => onEdit(3)}>
          {known.length || state.additionalContext ? [...known, state.additionalContext ? "Notes added" : null].filter(Boolean).join(" · ") : "None"}
        </ReviewRow>
        <ReviewRow label="Questions" onEdit={() => onEdit(3)}>
          {state.includeQuestions ? `Three questions (+${PRICE.questions})` : "No questions added"}
        </ReviewRow>
      </dl>

      {preview?.dstOverlap ? (
        <DstChoice
          name="dst"
          time={time24(state)}
          overlap={preview.dstOverlap}
          value={state.dstChoice}
          onChange={(v) => onChange({ dstChoice: v })}
          error={errors["birth.dstChoice"]}
        />
      ) : null}

      <CheckoutDetails
        email={state.email}
        phone={state.phone}
        consent={state.consent}
        adult={state.adult}
        onChange={(patch) => onChange(patch)}
        errors={errors}
        aboutSomeoneElseNote
      />

      <PriceSummary quote={preview?.quote ?? null} totalLabel={preview?.totalLabel ?? null} loading={previewLoading} />

      <p className="text-sm text-muted">Once you pay, these details are fixed for this order. Please check them now; changing them later means placing a new order.</p>
    </div>
  );
}
