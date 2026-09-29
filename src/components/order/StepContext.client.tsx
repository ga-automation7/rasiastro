"use client";

import { useId } from "react";
import { PRICING, QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "@/config/pricing";
import { NAKSHATRA_KEYS, NAKSHATRA_NAMES_EN, SIGN_KEYS, SIGN_NAMES_EN, type NakshatraKey, type SignKey } from "@/domain/astrology/constants";
import { formatInr } from "@/domain/pricing";
import { FieldShell } from "./fields";
import type { WizardState } from "./wizard-state";

const QUESTION_EXAMPLES = [
  "What themes might shape my career over the next two years?",
  "What should I keep in mind to build steadier relationships?",
  "How can I make the most of this period of change?",
];

export function StepContext({ state, onChange, errors }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void; errors: Record<string, string> }) {
  const ids = { moon: useId(), nak: useId(), pada: useId(), asc: useId(), other: useId(), ctx: useId(), q: useId() };
  const indian = state.tradition === "indian";
  const signLabel = (s: SignKey) => (indian ? `${SIGN_NAMES_EN[s].sanskrit} (${SIGN_NAMES_EN[s].western})` : SIGN_NAMES_EN[s].western);
  const setKnown = (patch: Partial<WizardState["known"]>) => onChange({ known: { ...state.known, ...patch } });
  const setQuestion = (i: number, v: string) => {
    const next = [...state.questions] as WizardState["questions"];
    next[i] = v;
    onChange({ questions: next });
  };

  return (
    <div className="space-y-8">
      <details className="card p-5" open={Boolean(state.known.moonSign || state.known.nakshatra || state.known.ascendant || state.known.otherDetails)}>
        <summary className="cursor-pointer text-lg font-semibold text-night-900">Already know something about your chart? (optional)</summary>
        <p className="mt-2 text-sm text-muted">
          Helpful context, never a replacement for our calculation. If what you know differs from what we calculate, your report shows both, respectfully, and explains why they can differ.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FieldShell label={indian ? "Rasi (Moon sign)" : "Moon sign"} htmlFor={ids.moon}>
            <select id={ids.moon} className="input" value={state.known.moonSign} onChange={(e) => setKnown({ moonSign: e.target.value as SignKey | "" })}>
              <option value="">Not sure</option>
              {SIGN_KEYS.map((s) => (
                <option key={s} value={s}>
                  {signLabel(s)}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label={indian ? "Lagna (Ascendant)" : "Rising sign (Ascendant)"} htmlFor={ids.asc}>
            <select id={ids.asc} className="input" value={state.known.ascendant} onChange={(e) => setKnown({ ascendant: e.target.value as SignKey | "" })}>
              <option value="">Not sure</option>
              {SIGN_KEYS.map((s) => (
                <option key={s} value={s}>
                  {signLabel(s)}
                </option>
              ))}
            </select>
          </FieldShell>
          {indian ? (
            <>
              <FieldShell label="Nakshatram / Nakshatra" htmlFor={ids.nak}>
                <select id={ids.nak} className="input" value={state.known.nakshatra} onChange={(e) => setKnown({ nakshatra: e.target.value as NakshatraKey | "" })}>
                  <option value="">Not sure</option>
                  {NAKSHATRA_KEYS.map((n) => (
                    <option key={n} value={n}>
                      {NAKSHATRA_NAMES_EN[n]}
                    </option>
                  ))}
                </select>
              </FieldShell>
              <FieldShell label="Pada" htmlFor={ids.pada} error={errors["known.pada"]}>
                <select id={ids.pada} className="input" value={state.known.pada} onChange={(e) => setKnown({ pada: e.target.value })}>
                  <option value="">Not sure</option>
                  {[1, 2, 3, 4].map((p) => (
                    <option key={p} value={String(p)}>
                      {p}
                    </option>
                  ))}
                </select>
              </FieldShell>
            </>
          ) : null}
        </div>
        <div className="mt-5">
          <FieldShell label="Other chart details you know" htmlFor={ids.other} error={errors["known.otherDetails"]} hint="For example: “My family astrologer said I am in Rahu dasha.” Max 500 characters.">
            <textarea id={ids.other} className="input min-h-20" maxLength={500} value={state.known.otherDetails} onChange={(e) => setKnown({ otherDetails: e.target.value })} />
          </FieldShell>
        </div>
      </details>

      <FieldShell
        label="Anything we should keep in mind? (optional)"
        htmlFor={ids.ctx}
        error={errors.additionalContext}
        hint="Current situation, concerns or areas you want the report to consider. Please don't include health, bank or ID details. Max 1000 characters."
      >
        <textarea id={ids.ctx} className="input min-h-28" maxLength={1000} value={state.additionalContext} onChange={(e) => onChange({ additionalContext: e.target.value })} />
      </FieldShell>

      <div className={`card p-5 ${state.includeQuestions ? "border-night-700 ring-2 ring-night-700" : ""}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1.5 h-5 w-5 accent-night-800" checked={state.includeQuestions} onChange={(e) => onChange({ includeQuestions: e.target.checked })} />
          <span>
            <span className="block text-lg font-semibold text-night-900">
              Add three personal questions · +{formatInr(PRICING.questionsAddon.amountPaise)} for all three
            </span>
            <span className="mt-1 block text-sm text-muted">
              Each question is answered in its own section of your report, grounded in your chart. Your total becomes {formatInr(PRICING.report.amountPaise + PRICING.questionsAddon.amountPaise)}.
            </span>
          </span>
        </label>
        {state.includeQuestions ? (
          <div className="mt-5 space-y-5">
            {errors.questions ? (
              <p className="field-error" role="alert">
                {errors.questions}
              </p>
            ) : null}
            {[0, 1, 2].map((i) => (
              <FieldShell
                key={i}
                label={`Question ${i + 1}`}
                htmlFor={`${ids.q}-${i}`}
                error={errors[`questions.${i}`]}
                hint={`${state.questions[i]!.length}/${QUESTION_MAX_LENGTH} characters · e.g. ${QUESTION_EXAMPLES[i]}`}
              >
                <textarea
                  id={`${ids.q}-${i}`}
                  className="input min-h-20"
                  maxLength={QUESTION_MAX_LENGTH}
                  minLength={QUESTION_MIN_LENGTH}
                  value={state.questions[i]}
                  placeholder={QUESTION_EXAMPLES[i]}
                  onChange={(e) => setQuestion(i, e.target.value)}
                  aria-invalid={Boolean(errors[`questions.${i}`])}
                />
              </FieldShell>
            ))}
            <p className="text-sm text-muted">
              Astrology can offer perspectives, not medical, legal or financial answers. Questions about health, death or investments will be answered with what astrology can and cannot say.
            </p>
            <button type="button" className="text-sm font-semibold text-night-700 underline" onClick={() => onChange({ includeQuestions: false })}>
              Remove the question add-on
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
