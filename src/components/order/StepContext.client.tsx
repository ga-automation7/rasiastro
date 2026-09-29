"use client";

import { useId } from "react";
import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "@/config/pricing";
import { COPY, PRICE } from "@/content/site-copy";
import { FieldShell } from "./fields";
import { KnownDetails } from "./KnownDetails.client";
import type { WizardState } from "./wizard-state";

const QUESTION_EXAMPLES = [
  "What themes might shape my work over the next two years?",
  "What could help me build steadier relationships?",
  "How can I make the most of this period of change?",
];

export function StepContext({ state, onChange, errors }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void; errors: Record<string, string> }) {
  const ids = { ctx: useId(), q: useId() };
  const setQuestion = (i: number, v: string) => {
    const next = [...state.questions] as WizardState["questions"];
    next[i] = v;
    onChange({ questions: next });
  };

  return (
    <div className="space-y-8">
      <KnownDetails
        value={state.known}
        onChange={(patch) => onChange({ known: { ...state.known, ...patch } })}
        tradition={state.tradition}
        errors={errors}
        prefix="known"
        title="Know something about your chart?"
      />

      <FieldShell
        label="Anything else you'd like us to consider? (optional)"
        htmlFor={ids.ctx}
        error={errors.additionalContext}
        hint="Your current situation, or areas you want the report to consider. We treat this as information you shared, not as something the chart revealed. Please leave out health, bank and ID details. Up to 1,000 characters."
      >
        <textarea id={ids.ctx} className="input min-h-28" maxLength={1000} value={state.additionalContext} onChange={(e) => onChange({ additionalContext: e.target.value })} />
      </FieldShell>

      <div className={`card p-5 transition-shadow duration-200 ${state.includeQuestions ? "border-ink-700 ring-2 ring-ink-700" : ""}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1.5 h-5 w-5 accent-ink-800" checked={state.includeQuestions} onChange={(e) => onChange({ includeQuestions: e.target.checked })} />
          <span>
            <span className="block text-lg font-semibold text-ink-900">
              {COPY.personal.addOn.title} {COPY.personal.addOn.price}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {COPY.personal.addOn.body} Your total becomes {PRICE.personalWithQuestions}.
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
                hint={`${state.questions[i]!.length}/${QUESTION_MAX_LENGTH} characters`}
              >
                <textarea
                  id={`${ids.q}-${i}`}
                  className="input min-h-20"
                  maxLength={QUESTION_MAX_LENGTH}
                  minLength={QUESTION_MIN_LENGTH}
                  value={state.questions[i]}
                  placeholder={`For example: ${QUESTION_EXAMPLES[i]}`}
                  onChange={(e) => setQuestion(i, e.target.value)}
                  aria-invalid={Boolean(errors[`questions.${i}`])}
                />
              </FieldShell>
            ))}
            <p className="text-sm text-muted">
              {COPY.personal.addOn.note} Astrology offers perspectives, not medical, legal or financial answers; questions like that are answered with what astrology can and cannot say.
            </p>
            <button type="button" className="text-sm font-semibold text-ink-700 underline underline-offset-2" onClick={() => onChange({ includeQuestions: false })}>
              Remove the questions
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
