"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PRICING } from "@/config/pricing";
import { OrderInputSchema, flattenIssues } from "@/domain/order-input";
import { formatInr } from "@/domain/pricing";
import type { LanguageCode, TraditionCode } from "@/config/languages";
import { openPayment, postJson, recordFormStarted } from "./checkout";
import { BirthDetailsStep } from "./BirthDetailsStep.client";
import { firstBirthError, personalBirthErrors } from "./birth-input";
import { StepChoose } from "./StepChoose.client";
import { StepContext } from "./StepContext.client";
import { StepReview, type PreviewResult } from "./StepReview.client";
import { EMPTY_STATE, from24, stepForField, toOrderInput, type PlaceOption, type StepId, type WizardState } from "./wizard-state";

const STEPS: { id: StepId; title: string; short: string }[] = [
  { id: 1, title: "Choose your report", short: "Choose system" },
  { id: 2, title: "Your birth details", short: "Birth details" },
  { id: 3, title: "Notes and questions", short: "Personalise" },
  { id: 4, title: "Review your details", short: "Review" },
];

/** Minimal per-step checks for quick feedback; the server re-validates everything. */
function stepErrors(step: StepId, s: WizardState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!s.tradition) e.tradition = "Please choose a tradition.";
    if (!s.language) e.language = "Please choose a report language.";
  }
  // One problem at a time, in the order the fields appear.
  if (step === 2) Object.assign(e, firstBirthError(s, "birth"));
  if (step === 3 && s.includeQuestions) {
    s.questions.forEach((q, i) => {
      if (q.trim().length < 10) e[`questions.${i}`] = "Please write at least 10 characters, or remove the questions.";
    });
  }
  return e;
}

export function OrderWizard({
  checkoutAvailable,
  initialTradition,
  initialQuestions,
  fromOrderId,
}: {
  checkoutAvailable: boolean;
  initialTradition: TraditionCode | null;
  initialQuestions: boolean;
  fromOrderId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({ ...EMPTY_STATE, tradition: initialTradition, includeQuestions: initialQuestions });
  const [step, setStep] = useState<StepId>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(false);
  const startedEvent = useRef(false);

  const update = useCallback((patch: Partial<WizardState>) => {
    dirty.current = true;
    if (!startedEvent.current) {
      startedEvent.current = true;
      recordFormStarted();
    }
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // Warn before leaving with unsaved details (they are intentionally not stored in the browser).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current && !submitting) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  // "Start a new order with these details" from an existing order.
  useEffect(() => {
    if (!fromOrderId) return;
    void (async () => {
      const res = await fetch(`/api/orders/${encodeURIComponent(fromOrderId)}/prefill`);
      if (!res.ok) return;
      const p = (await res.json()) as {
        product: "personal" | "compatibility";
        tradition: TraditionCode;
        language: LanguageCode;
        birth: { subjectName: string; birthDate: string; timeCertainty: WizardState["timeCertainty"]; birthTime: string | null; timeWindowMinutes: number | null; place: PlaceOption };
        known: { moonSign: string | null; nakshatra: string | null; pada: number | null; ascendant: string | null; otherDetails: string | null };
        additionalContext: string | null;
        includeQuestions: boolean;
        questions: string[];
        email: string;
        phone: string | null;
      };
      if (p.product !== "personal") return;
      const [y, m, d] = p.birth.birthDate.split("-");
      setState({
        ...EMPTY_STATE,
        tradition: p.tradition,
        language: p.language,
        subjectName: p.birth.subjectName,
        year: y ?? "",
        month: String(Number(m)),
        day: String(Number(d)),
        timeCertainty: p.birth.timeCertainty,
        ...from24(p.birth.birthTime),
        timeWindowMinutes: p.birth.timeWindowMinutes,
        place: p.birth.place,
        known: {
          moonSign: (p.known.moonSign ?? "") as WizardState["known"]["moonSign"],
          nakshatra: (p.known.nakshatra ?? "") as WizardState["known"]["nakshatra"],
          pada: p.known.pada ? String(p.known.pada) : "",
          ascendant: (p.known.ascendant ?? "") as WizardState["known"]["ascendant"],
          otherDetails: p.known.otherDetails ?? "",
        },
        additionalContext: p.additionalContext ?? "",
        includeQuestions: p.includeQuestions,
        questions: [p.questions[0] ?? "", p.questions[1] ?? "", p.questions[2] ?? ""],
        email: p.email === "erased" ? "" : p.email,
        phone: p.phone ?? "",
      });
      setBanner("We filled in the details from your earlier order. Change anything you need, then pay for the new order.");
    })();
  }, [fromOrderId]);

  const goTo = useCallback((next: StepId) => {
    setStep(next);
    setErrors({});
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, []);

  const runPreview = useCallback(async (s: WizardState) => {
    setPreviewLoading(true);
    const res = await postJson<PreviewResult>("/api/orders/preview", { ...toOrderInput(s), email: s.email || "preview@example.com", phone: s.phone || "9999999999", consentProcessing: true, adultConfirmed: true });
    setPreviewLoading(false);
    if (res.ok) {
      setPreview(res.data);
      return true;
    }
    setPreview(null);
    const fields = res.error.fields ?? {};
    const firstStep = Object.keys(fields).map(stepForField).sort()[0];
    if (firstStep && firstStep < 4) {
      goTo(firstStep);
      setErrors(fields);
    } else {
      setBanner(res.error.message);
    }
    return false;
  }, [goTo]);

  const next = async () => {
    const e = stepErrors(step, state);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (step === 3) {
      goTo(4);
      await runPreview(state);
      return;
    }
    goTo((step + 1) as StepId);
  };

  const pay = async () => {
    setBanner(null);
    const parsed = OrderInputSchema.safeParse(toOrderInput(state));
    if (!parsed.success) {
      const fields = flattenIssues(parsed.error);
      const target = Object.keys(fields).map(stepForField).sort()[0] ?? 4;
      if (target !== 4) goTo(target);
      setErrors(fields);
      return;
    }
    if (preview?.dstOverlap && !state.dstChoice) {
      setErrors({ "birth.dstChoice": "Please choose which of the two times is correct." });
      return;
    }
    setSubmitting(true);
    const created = await postJson<{ orderId: string; reference: string }>("/api/orders", toOrderInput(state));
    if (!created.ok) {
      setSubmitting(false);
      const fields = created.error.fields ?? {};
      if (Object.keys(fields).length) {
        const target = Object.keys(fields).map(stepForField).sort()[0] ?? 4;
        if (target !== step) goTo(target);
        setErrors(fields);
      }
      setBanner(created.error.message);
      return;
    }
    dirty.current = false;
    await openPayment(created.data.orderId, (href) => router.push(href));
  };

  const total = state.includeQuestions ? PRICING.report.amountPaise + PRICING.questionsAddon.amountPaise : PRICING.report.amountPaise;
  const birthReady = step === 2 && Object.keys(personalBirthErrors(state)).length === 0;

  return (
    <div className="relative isolate">
      {/* Depth without distraction: warm light, faint orbits, a soft vignette. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgb(247_236_210/0.9),transparent_70%),radial-gradient(ellipse_120%_90%_at_50%_40%,transparent_55%,rgb(122_86_26/0.07))]" />
        <svg viewBox="0 0 800 800" className="absolute -right-64 top-24 h-[46rem] w-[46rem] opacity-[0.22]" fill="none" stroke="var(--color-gold-500)">
          <circle cx="400" cy="400" r="390" strokeWidth="0.8" />
          <circle cx="400" cy="400" r="300" strokeWidth="0.6" strokeDasharray="2 7" />
          <circle cx="400" cy="400" r="210" strokeWidth="0.6" />
          <circle cx="400" cy="10" r="3.5" fill="var(--color-gold-500)" stroke="none" />
          <circle cx="190" cy="400" r="2.5" fill="var(--color-gold-500)" stroke="none" />
        </svg>
      </div>
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Order steps" className="mb-10">
        <div className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">
          <span>
            Step {step} of {STEPS.length}
            <span className="sm:hidden"> · {STEPS[step - 1]!.short}</span>
          </span>
          {step === 2 ? <span className="hidden sm:inline">Personal report · {formatInr(PRICING.report.amountPaise)}</span> : null}
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-1.5">
          {STEPS.map((s) => (
            <li key={s.id} aria-current={s.id === step ? "step" : undefined}>
              <span className="relative block h-[3px] overflow-hidden rounded-full bg-ivory-300/80">
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-700 ease-[var(--ease-soft)] ${s.id < step ? "w-full" : s.id === step ? "w-1/2" : "w-0"}`}
                />
              </span>
              <span className={`mt-2 hidden text-xs font-semibold transition-colors duration-300 sm:block ${s.id === step ? "text-ink-900" : s.id < step ? "text-gold-700" : "text-muted"}`}>
                <span className="sr-only">Step {s.id}: </span>
                {s.short}
                <span className="sr-only">{s.id < step ? " (done)" : s.id === step ? " (current)" : ""}</span>
              </span>
              <span className="sr-only sm:hidden">
                Step {s.id}: {s.short}
                {s.id < step ? " (done)" : s.id === step ? " (current)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {step === 2 ? (
        <header className="step-reveal">
          <p className="eyebrow">Your birth details</p>
          <h1 ref={headingRef} tabIndex={-1} className="h-section mt-2 text-ink-950 outline-none">
            Let&apos;s find your chart.
          </h1>
          <p className="lede mt-3 max-w-xl">A few details about the moment you were born are all we need to calculate it.</p>
        </header>
      ) : (
        <>
          <p className="eyebrow">Personal report · {formatInr(PRICING.report.amountPaise)}</p>
          <h1 ref={headingRef} tabIndex={-1} className="h-section mt-2 text-ink-950 outline-none">
            {STEPS[step - 1]!.title}
          </h1>
        </>
      )}
      {banner ? (
        <p role="alert" className="mt-4 rounded-xl border border-night-600/30 bg-white p-4 text-sm">
          {banner}
        </p>
      ) : null}

      <form
        className="relative mt-8 rounded-[1.75rem] border border-ivory-300/80 bg-ivory-50/95 p-5 shadow-[0_1px_0_rgb(255_255_255/0.9)_inset,0_30px_60px_-40px_rgb(10_21_35/0.35),0_8px_20px_-14px_rgb(10_21_35/0.15)] sm:p-9"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void (step === 4 ? pay() : next());
        }}
      >
        {step === 1 ? <StepChoose tradition={state.tradition} language={state.language} onChange={update} errors={errors} /> : null}
        {step === 2 ? <BirthDetailsStep value={state} onChange={update} errors={errors} tradition={state.tradition} /> : null}
        {step === 3 ? <StepContext state={state} onChange={update} errors={errors} /> : null}
        {step === 4 ? (
          <StepReview
            state={state}
            preview={preview}
            previewLoading={previewLoading}
            onChange={(patch) => {
              update(patch);
              // Choosing which repeated hour applies changes the resolved birth moment.
              if (patch.dstChoice) void runPreview({ ...state, ...patch });
            }}
            onEdit={goTo}
            errors={errors}
          />
        ) : null}

        {step === 2 && birthReady ? (
          <p className="step-reveal mt-10 flex items-center justify-end gap-2 text-sm font-medium text-teal-700" aria-live="polite">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
            </svg>
            Everything we need to calculate your chart.
          </p>
        ) : null}
        <div className={`${step === 2 && birthReady ? "mt-4" : "mt-10"} flex flex-col-reverse gap-3 border-t border-ivory-300/80 pt-6 sm:flex-row sm:items-center sm:justify-between`}>
          {step > 1 ? (
            <button type="button" className="min-h-12 self-start rounded-lg px-2 text-[0.95rem] font-semibold text-ink-700 transition-colors hover:text-ink-950 sm:self-auto" onClick={() => goTo((step - 1) as StepId)} disabled={submitting}>
              <span aria-hidden="true">← </span>Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button
              type="submit"
              className={`btn group min-w-44 gap-2 text-[1rem] transition-all duration-300 ${step === 2 && !birthReady ? "bg-ink-900/55 text-ivory-50 shadow-none" : "btn-dark shadow-[0_12px_28px_-14px_rgb(10_21_35/0.7)]"}`}
              aria-disabled={step === 2 && !birthReady ? true : undefined}
            >
              Continue
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </button>
          ) : (
            <button type="submit" className="btn btn-primary text-base" disabled={submitting || !checkoutAvailable || previewLoading || !preview} aria-disabled={submitting || !checkoutAvailable}>
              {submitting ? "Opening secure payment…" : `Continue to payment · ${preview?.totalLabel ?? formatInr(total)}`}
            </button>
          )}
        </div>
        {step === 4 ? <p className="mt-3 text-right text-xs text-muted">You pay on our payment partner&apos;s secure page. We never see your card or UPI details.</p> : null}
      </form>
    </div>
    </div>
  );
}
