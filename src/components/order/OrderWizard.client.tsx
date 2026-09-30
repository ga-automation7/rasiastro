"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PRICING } from "@/config/pricing";
import { OrderInputSchema, flattenIssues } from "@/domain/order-input";
import { formatInr } from "@/domain/pricing";
import type { LanguageCode, TraditionCode } from "@/config/languages";
import { openPayment, postJson, recordFormStarted } from "./checkout";
import { birthErrors } from "./person";
import { StepBirth } from "./StepBirth.client";
import { StepChoose } from "./StepChoose.client";
import { StepContext } from "./StepContext.client";
import { StepReview, type PreviewResult } from "./StepReview.client";
import { EMPTY_STATE, from24, stepForField, toOrderInput, type PlaceOption, type StepId, type WizardState } from "./wizard-state";

const STEPS: { id: StepId; title: string }[] = [
  { id: 1, title: "Choose your report" },
  { id: 2, title: "Your birth details" },
  { id: 3, title: "Notes and questions" },
  { id: 4, title: "Review your details" },
];

/** Minimal per-step checks for quick feedback; the server re-validates everything. */
function stepErrors(step: StepId, s: WizardState): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!s.tradition) e.tradition = "Please choose a tradition.";
    if (!s.language) e.language = "Please choose a report language.";
  }
  if (step === 2) Object.assign(e, birthErrors(s, "birth"));
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Order steps" className="mb-8">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => (
            <li key={s.id}>
              <div className={`h-1.5 rounded-full transition-colors duration-300 ${s.id <= step ? "bg-vermilion-600" : "bg-ivory-300"}`} />
              <p className={`mt-2 hidden text-xs font-semibold sm:block ${s.id === step ? "text-ink-900" : "text-muted"}`} aria-current={s.id === step ? "step" : undefined}>
                {s.id}. {s.title}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted sm:hidden">
          Step {step} of 4: {STEPS[step - 1]!.title}
        </p>
      </nav>

      <p className="eyebrow">Personal report · {formatInr(PRICING.report.amountPaise)}</p>
      <h1 ref={headingRef} tabIndex={-1} className="h-section mt-2 text-ink-950 outline-none">
        {STEPS[step - 1]!.title}
      </h1>
      {banner ? (
        <p role="alert" className="mt-4 rounded-xl border border-night-600/30 bg-white p-4 text-sm">
          {banner}
        </p>
      ) : null}

      <form
        className="mt-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void (step === 4 ? pay() : next());
        }}
      >
        {step === 1 ? <StepChoose tradition={state.tradition} language={state.language} onChange={update} errors={errors} /> : null}
        {step === 2 ? <StepBirth state={state} onChange={update} errors={errors} /> : null}
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

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-ivory-300 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 ? (
            <button type="button" className="btn btn-ghost text-ink-800" onClick={() => goTo((step - 1) as StepId)} disabled={submitting}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button type="submit" className="btn btn-dark">
              Continue
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
  );
}
