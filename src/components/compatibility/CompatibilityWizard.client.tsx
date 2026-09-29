"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PERSON_NOTE_LIMIT, SHARED_CONTEXT_LIMITS, getCategory, type CompatibilityCategory } from "@/config/compatibility";
import { REPORT_LANGUAGES, TRADITIONS, type LanguageCode, type TraditionCode } from "@/config/languages";
import { CompatibilityOrderInputSchema, type CompatibilityOrderInputRaw } from "@/domain/compatibility-input";
import { flattenIssues } from "@/domain/order-input";
import { PRICE } from "@/content/site-copy";
import { BirthFields } from "../order/BirthFields.client";
import { CheckoutDetails, PriceSummary, type QuoteView } from "../order/CheckoutDetails.client";
import { openPayment, postJson, recordFormStarted } from "../order/checkout";
import { ChoiceCards, FieldShell } from "../order/fields";
import { KnownDetails } from "../order/KnownDetails.client";
import { EMPTY_BIRTH, EMPTY_KNOWN, birthErrors, birthInput, dateLabel, from24, knownInput, placeLabel, time24, timeLabel, type BirthFieldsState, type KnownState, type PlaceOption } from "../order/person";
import { DstChoice, ReviewRow } from "../order/StepReview.client";
import { CategorySelector } from "./CategorySelector.client";

/**
 * Two-person compatibility order form. Kept in memory only (never stored in the
 * browser). Changing the category keeps everything already entered; only the examples
 * and prompts change. Each person's birthplace and historical time zone are resolved
 * separately on the server.
 */
interface PersonForm {
  birth: BirthFieldsState;
  known: KnownState;
  additionalInfo: string;
}

interface SharedForm {
  howKnown: string;
  knownDuration: string;
  hopes: string;
  sharedCircumstances: string;
}

interface CompatState {
  category: CompatibilityCategory;
  tradition: TraditionCode | null;
  language: LanguageCode | null;
  people: [PersonForm, PersonForm];
  shared: SharedForm;
  email: string;
  phone: string;
  consent: boolean;
  adult: boolean;
  permission: boolean;
}

type StepId = 1 | 2 | 3 | 4 | 5;
const STEPS: { id: StepId; title: string }[] = [
  { id: 1, title: "Your connection" },
  { id: 2, title: "Person A's details" },
  { id: 3, title: "Person B's details" },
  { id: 4, title: "About your connection" },
  { id: 5, title: "Review your details" },
];

const EMPTY_PERSON: PersonForm = { birth: EMPTY_BIRTH, known: EMPTY_KNOWN, additionalInfo: "" };

interface Preview {
  quote: QuoteView;
  totalLabel: string;
  participants: [{ placeLabel: string; timeZoneId: string; utcOffsetLabel: string } | null, { placeLabel: string; timeZoneId: string; utcOffsetLabel: string } | null];
  dstOverlaps: [{ earlierOffsetLabel: string; laterOffsetLabel: string } | null, { earlierOffsetLabel: string; laterOffsetLabel: string } | null];
}

function toInput(s: CompatState): CompatibilityOrderInputRaw {
  const person = (p: PersonForm) => ({ birth: birthInput(p.birth), known: knownInput(p.known, s.tradition), additionalInfo: p.additionalInfo.trim() || null });
  const t = (v: string) => v.trim() || null;
  return {
    category: s.category,
    tradition: s.tradition ?? ("" as TraditionCode),
    language: s.language ?? ("" as LanguageCode),
    participants: [person(s.people[0]), person(s.people[1])],
    shared: { howKnown: t(s.shared.howKnown), knownDuration: t(s.shared.knownDuration), hopes: t(s.shared.hopes), sharedCircumstances: t(s.shared.sharedCircumstances) },
    email: s.email,
    phone: s.phone,
    consentProcessing: s.consent as true,
    adultConfirmed: s.adult as true,
    thirdPartyPermission: s.permission as true,
  };
}

function stepForField(field: string): StepId {
  if (field.startsWith("category") || field.startsWith("tradition") || field.startsWith("language")) return 1;
  if (field.startsWith("participants.0")) return 2;
  if (field.startsWith("participants.1")) return 3;
  if (field.startsWith("shared")) return 4;
  return 5;
}

function personLabel(index: 0 | 1, name: string): string {
  const letter = index === 0 ? "A" : "B";
  return name.trim() ? `Person ${letter} · ${name.trim()}` : `Person ${letter}`;
}

export function CompatibilityWizard({ initialCategory, fromOrderId }: { initialCategory: CompatibilityCategory | null; fromOrderId: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<CompatState>({
    category: initialCategory ?? "relationship",
    tradition: null,
    language: null,
    people: [EMPTY_PERSON, EMPTY_PERSON],
    shared: { howKnown: "", knownDuration: "", hopes: "", sharedCircumstances: "" },
    email: "",
    phone: "",
    consent: false,
    adult: false,
    permission: false,
  });
  const [step, setStep] = useState<StepId>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = useRef(false);
  const started = useRef(false);
  const ids = { howKnown: useId(), duration: useId(), hopes: useId(), circumstances: useId(), noteA: useId(), noteB: useId() };

  const update = useCallback((patch: Partial<CompatState>) => {
    dirty.current = true;
    if (!started.current) {
      started.current = true;
      recordFormStarted();
    }
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const updatePerson = useCallback((index: 0 | 1, patch: Partial<PersonForm>) => {
    dirty.current = true;
    setState((s) => {
      const people = [...s.people] as CompatState["people"];
      people[index] = { ...people[index], ...patch };
      return { ...s, people };
    });
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current && !submitting) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  // "Start a new order with these details" from an earlier compatibility order.
  useEffect(() => {
    if (!fromOrderId) return;
    void (async () => {
      const res = await fetch(`/api/orders/${encodeURIComponent(fromOrderId)}/prefill`);
      if (!res.ok) return;
      type PrefillPerson = {
        birth: { subjectName: string; birthDate: string; timeCertainty: BirthFieldsState["timeCertainty"]; birthTime: string | null; timeWindowMinutes: number | null; place: PlaceOption };
        known: { moonSign: string | null; nakshatra: string | null; pada: number | null; ascendant: string | null; otherDetails: string | null };
        additionalInfo: string | null;
      };
      const p = (await res.json()) as {
        product: string;
        category: CompatibilityCategory;
        tradition: TraditionCode;
        language: LanguageCode;
        participants: [PrefillPerson, PrefillPerson];
        shared: { howKnown: string | null; knownDuration: string | null; hopes: string | null; sharedCircumstances: string | null };
        email: string;
        phone: string | null;
      };
      if (p.product !== "compatibility") return;
      const toPerson = (x: PrefillPerson): PersonForm => {
        const [y, m, d] = x.birth.birthDate.split("-");
        return {
          birth: {
            ...EMPTY_BIRTH,
            subjectName: x.birth.subjectName,
            year: y ?? "",
            month: String(Number(m)),
            day: String(Number(d)),
            timeCertainty: x.birth.timeCertainty,
            ...from24(x.birth.birthTime),
            timeWindowMinutes: x.birth.timeWindowMinutes,
            place: x.birth.place,
          },
          known: {
            moonSign: (x.known.moonSign ?? "") as KnownState["moonSign"],
            nakshatra: (x.known.nakshatra ?? "") as KnownState["nakshatra"],
            pada: x.known.pada ? String(x.known.pada) : "",
            ascendant: (x.known.ascendant ?? "") as KnownState["ascendant"],
            otherDetails: x.known.otherDetails ?? "",
          },
          additionalInfo: x.additionalInfo ?? "",
        };
      };
      setState((s) => ({
        ...s,
        category: p.category,
        tradition: p.tradition,
        language: p.language,
        people: [toPerson(p.participants[0]), toPerson(p.participants[1])],
        shared: { howKnown: p.shared.howKnown ?? "", knownDuration: p.shared.knownDuration ?? "", hopes: p.shared.hopes ?? "", sharedCircumstances: p.shared.sharedCircumstances ?? "" },
        email: p.email === "erased" ? "" : p.email,
        phone: p.phone ?? "",
      }));
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

  const stepErrors = (s: CompatState, current: StepId): Record<string, string> => {
    const e: Record<string, string> = {};
    if (current === 1) {
      if (!s.tradition) e.tradition = "Please choose a tradition.";
      if (!s.language) e.language = "Please choose a report language.";
    }
    if (current === 2) Object.assign(e, birthErrors(s.people[0].birth, "participants.0.birth"));
    if (current === 3) Object.assign(e, birthErrors(s.people[1].birth, "participants.1.birth"));
    return e;
  };

  const runPreview = useCallback(
    async (s: CompatState) => {
      setPreviewLoading(true);
      const input = { ...toInput(s), email: s.email || "preview@example.com", phone: s.phone || "9999999999", consentProcessing: true, adultConfirmed: true, thirdPartyPermission: true };
      const res = await postJson<Preview>("/api/compatibility/orders/preview", input);
      setPreviewLoading(false);
      if (res.ok) {
        setPreview(res.data);
        return;
      }
      setPreview(null);
      const fields = res.error.fields ?? {};
      const first = Object.keys(fields).map(stepForField).sort()[0];
      if (first && first < 5) {
        goTo(first);
        setErrors(fields);
      } else {
        setBanner(res.error.message);
      }
    },
    [goTo],
  );

  const next = async () => {
    const e = stepErrors(state, step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (step === 4) {
      goTo(5);
      await runPreview(state);
      return;
    }
    goTo((step + 1) as StepId);
  };

  const pay = async () => {
    setBanner(null);
    const parsed = CompatibilityOrderInputSchema.safeParse(toInput(state));
    if (!parsed.success) {
      const fields = flattenIssues(parsed.error);
      const target = Object.keys(fields).map(stepForField).sort()[0] ?? 5;
      if (target !== 5) goTo(target);
      setErrors(fields);
      return;
    }
    const dst: Record<string, string> = {};
    ([0, 1] as const).forEach((i) => {
      if (preview?.dstOverlaps[i] && !state.people[i].birth.dstChoice) dst[`participants.${i}.birth.dstChoice`] = "Please choose which of the two times is correct.";
    });
    if (Object.keys(dst).length) {
      setErrors(dst);
      return;
    }
    setSubmitting(true);
    const created = await postJson<{ orderId: string }>("/api/compatibility/orders", toInput(state));
    if (!created.ok) {
      setSubmitting(false);
      const fields = created.error.fields ?? {};
      if (Object.keys(fields).length) {
        const target = Object.keys(fields).map(stepForField).sort()[0] ?? 5;
        if (target !== step) goTo(target);
        setErrors(fields);
      }
      setBanner(created.error.message);
      return;
    }
    dirty.current = false;
    await openPayment(created.data.orderId, (href) => router.push(href));
  };

  const category = getCategory(state.category);

  const personStep = (index: 0 | 1) => {
    const person = state.people[index];
    const other = state.people[index === 0 ? 1 : 0].birth.subjectName.trim();
    return (
      <div className="space-y-8">
        <p className="text-muted">
          {index === 0
            ? "Start with either person. Each person's birthplace and time zone are worked out separately."
            : `Now the second person${other ? `, who connects with ${other}` : ""}.`}
        </p>
        <BirthFields
          value={person.birth}
          onChange={(patch) => updatePerson(index, { birth: { ...person.birth, ...patch } })}
          errors={errors}
          prefix={`participants.${index}.birth`}
          tradition={state.tradition}
          nameLabel={`Person ${index === 0 ? "A" : "B"}'s full name`}
          nameHint="Shown on the report. Names are never sent to the AI."
        />
        <KnownDetails
          value={person.known}
          onChange={(patch) => updatePerson(index, { known: { ...person.known, ...patch } })}
          tradition={state.tradition}
          errors={errors}
          prefix={`participants.${index}.known`}
          title={`Know something about ${person.birth.subjectName.trim() || `Person ${index === 0 ? "A" : "B"}`}'s chart?`}
        />
        <FieldShell
          label="Additional information about this person (optional)"
          htmlFor={index === 0 ? ids.noteA : ids.noteB}
          error={errors[`participants.${index}.additionalInfo`]}
          hint={`For example, how they tend to communicate or what matters to them. Only about this person; shared context comes later. Up to ${PERSON_NOTE_LIMIT} characters.`}
        >
          <textarea
            id={index === 0 ? ids.noteA : ids.noteB}
            className="input min-h-24"
            maxLength={PERSON_NOTE_LIMIT}
            value={person.additionalInfo}
            onChange={(e) => updatePerson(index, { additionalInfo: e.target.value })}
          />
        </FieldShell>
      </div>
    );
  };

  const sharedField = (key: keyof SharedForm, id: string, label: string, rows: boolean) => (
    <FieldShell label={label} htmlFor={id} error={errors[`shared.${key}`]} hint={`${state.shared[key].length}/${SHARED_CONTEXT_LIMITS[key]} characters`}>
      {rows ? (
        <textarea
          id={id}
          className="input min-h-24"
          maxLength={SHARED_CONTEXT_LIMITS[key]}
          placeholder={category.examples[key]}
          value={state.shared[key]}
          onChange={(e) => update({ shared: { ...state.shared, [key]: e.target.value } })}
        />
      ) : (
        <input
          id={id}
          className="input"
          maxLength={SHARED_CONTEXT_LIMITS[key]}
          placeholder={category.examples[key]}
          value={state.shared[key]}
          onChange={(e) => update({ shared: { ...state.shared, [key]: e.target.value } })}
        />
      )}
    </FieldShell>
  );

  const addPrompt = (prompt: string) => {
    const current = state.shared.hopes.trim();
    if (current.includes(prompt)) return;
    const combined = current ? `${current}\n${prompt}` : prompt;
    update({ shared: { ...state.shared, hopes: combined.slice(0, SHARED_CONTEXT_LIMITS.hopes) } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Order steps" className="mb-8">
        <ol className="grid grid-cols-5 gap-2">
          {STEPS.map((s) => (
            <li key={s.id}>
              <div className={`h-1.5 rounded-full transition-colors duration-300 ${s.id <= step ? "bg-vermilion-600" : "bg-ivory-300"}`} />
              <p className={`mt-2 hidden text-xs font-semibold md:block ${s.id === step ? "text-ink-900" : "text-muted"}`} aria-current={s.id === step ? "step" : undefined}>
                {s.id}. {s.title}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted md:hidden">
          Step {step} of 5: {STEPS[step - 1]!.title}
        </p>
      </nav>

      <p className="eyebrow">
        Compatibility · {PRICE.compatibility} for two · {category.label}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="h-section mt-2 text-ink-950 outline-none">
        {step === 2 || step === 3 ? `${personLabel(step === 2 ? 0 : 1, state.people[step === 2 ? 0 : 1].birth.subjectName).replace(/^Person ([AB])/, "Person $1's details")}` : STEPS[step - 1]!.title}
      </h1>

      {banner ? (
        <p role="alert" className="mt-4 rounded-xl border border-ink-600/30 bg-ivory-50 p-4 text-sm">
          {banner}
        </p>
      ) : null}

      <form
        className="mt-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void (step === 5 ? pay() : next());
        }}
      >
        {step === 1 ? (
          <div className="space-y-8">
            <CategorySelector value={state.category} onChange={(c) => update({ category: c })} legend="Which connection would you like to understand?" error={errors.category} />
            <ChoiceCards
              legend="Astrology tradition"
              name="tradition"
              value={state.tradition}
              onChange={(v) => update({ tradition: v })}
              error={errors.tradition}
              options={TRADITIONS.map((t) => ({ value: t.code, title: t.title, description: t.code === "indian" ? "Both Jathagams side by side, with traditional compatibility factors." : "Both natal charts, with the planetary contacts between them." }))}
            />
            <ChoiceCards
              legend="Report language"
              name="language"
              columns={3}
              value={state.language}
              onChange={(v) => update({ language: v })}
              error={errors.language}
              options={REPORT_LANGUAGES.filter((l) => l.enabled).map((l) => ({
                value: l.code,
                title: (
                  <span lang={l.htmlLang}>
                    {l.nativeName}
                    {l.code !== "en" ? (
                      <span className="ml-2 text-sm font-normal text-muted" lang="en">
                        {l.englishName}
                      </span>
                    ) : null}
                  </span>
                ),
              }))}
            />
            <p className="text-sm text-muted">One report for two people, in one tradition and one language. There is no question add-on for compatibility reports.</p>
          </div>
        ) : null}

        {step === 2 ? personStep(0) : null}
        {step === 3 ? personStep(1) : null}

        {step === 4 ? (
          <div className="space-y-6">
            <p className="text-muted">
              All optional. This is information you share with us; the report treats it as context, never as something the charts revealed. Examples below are for <strong>{category.label.toLowerCase()}</strong>.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {sharedField("howKnown", ids.howKnown, "How do you know each other?", false)}
              {sharedField("knownDuration", ids.duration, "For how long?", false)}
            </div>
            {sharedField("hopes", ids.hopes, "What would you like to understand?", true)}
            <div>
              <p className="text-sm font-semibold text-ink-900">Ideas for {category.label.toLowerCase()}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {category.prompts.map((prompt) => (
                  <li key={prompt}>
                    <button type="button" onClick={() => addPrompt(prompt)} className="rounded-full border border-ink-800/25 px-3 py-1.5 text-sm text-ink-900 transition-colors duration-150 hover:border-ink-800/60 hover:bg-ivory-50">
                      + {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {sharedField("sharedCircumstances", ids.circumstances, "Anything about your shared circumstances?", true)}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-8">
            <dl className="card px-5">
              <ReviewRow label="Connection" onEdit={() => goTo(1)}>
                {category.label}
              </ReviewRow>
              <ReviewRow label="Tradition and language" onEdit={() => goTo(1)}>
                {TRADITIONS.find((t) => t.code === state.tradition)?.title ?? "-"} ·{" "}
                {(() => {
                  const l = REPORT_LANGUAGES.find((x) => x.code === state.language);
                  return l ? <span lang={l.htmlLang}>{l.nativeName}</span> : "-";
                })()}
              </ReviewRow>
            </dl>
            {([0, 1] as const).map((i) => {
              const p = state.people[i];
              const resolved = preview?.participants[i] ?? null;
              const overlap = preview?.dstOverlaps[i] ?? null;
              return (
                <div key={i} className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-ink-900">{personLabel(i, p.birth.subjectName)}</h2>
                  <dl className="card px-5">
                    <ReviewRow label="Date of birth" onEdit={() => goTo(i === 0 ? 2 : 3)}>
                      {dateLabel(p.birth)}
                    </ReviewRow>
                    <ReviewRow label="Time of birth" onEdit={() => goTo(i === 0 ? 2 : 3)}>
                      {timeLabel(p.birth)}
                    </ReviewRow>
                    <ReviewRow label="Birthplace" onEdit={() => goTo(i === 0 ? 2 : 3)}>
                      {p.birth.place ? placeLabel(p.birth.place) : "-"}
                      {resolved ? (
                        <span className="mt-1 block text-sm text-muted">
                          Time zone at birth: {resolved.timeZoneId}, {resolved.utcOffsetLabel}
                        </span>
                      ) : null}
                    </ReviewRow>
                    <ReviewRow label="Notes about this person" onEdit={() => goTo(i === 0 ? 2 : 3)}>
                      {p.additionalInfo.trim() ? "Added" : "None"}
                    </ReviewRow>
                  </dl>
                  {overlap ? (
                    <DstChoice
                      name={`dst-${i}`}
                      time={time24(p.birth)}
                      overlap={overlap}
                      value={p.birth.dstChoice}
                      onChange={(v) => {
                        const nextPeople = [...state.people] as CompatState["people"];
                        nextPeople[i] = { ...p, birth: { ...p.birth, dstChoice: v } };
                        update({ people: nextPeople });
                        void runPreview({ ...state, people: nextPeople });
                      }}
                      error={errors[`participants.${i}.birth.dstChoice`]}
                    />
                  ) : null}
                </div>
              );
            })}
            <dl className="card px-5">
              <ReviewRow label="About your connection" onEdit={() => goTo(4)}>
                {Object.values(state.shared).some((v) => v.trim()) ? "Added" : "None"}
              </ReviewRow>
            </dl>
            <CheckoutDetails
              email={state.email}
              phone={state.phone}
              consent={state.consent}
              adult={state.adult}
              permission={state.permission}
              onChange={(patch) => update(patch)}
              errors={errors}
              aboutSomeoneElseNote={false}
            />
            <PriceSummary quote={preview?.quote ?? null} totalLabel={preview?.totalLabel ?? null} loading={previewLoading} />
            <p className="text-sm text-muted">Once you pay, these details are fixed for this order. Please check them now; changing them later means placing a new order.</p>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-ivory-300 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 ? (
            <button type="button" className="btn btn-ghost text-ink-800" onClick={() => goTo((step - 1) as StepId)} disabled={submitting}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 5 ? (
            <button type="submit" className="btn btn-dark">
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-primary text-base" disabled={submitting || previewLoading || !preview} aria-disabled={submitting}>
              {submitting ? "Opening secure payment…" : `Continue to payment · ${preview?.totalLabel ?? PRICE.compatibility}`}
            </button>
          )}
        </div>
        {step === 5 ? <p className="mt-3 text-right text-xs text-muted">Payments are handled by Cashfree Payments. We never see your card or UPI details.</p> : null}
      </form>
    </div>
  );
}

