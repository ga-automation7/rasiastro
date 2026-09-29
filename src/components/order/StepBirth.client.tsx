"use client";

import { useId } from "react";
import { TIME_WINDOW_OPTIONS } from "@/domain/order-input";
import { ChoiceCards, FieldShell, describedBy } from "./fields";
import { PlaceSearch } from "./PlaceSearch.client";
import { MONTHS, time24, type WizardState } from "./wizard-state";

type Patch = Partial<WizardState>;

const YEARS = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 1900 + 1 }, (_, i) => String(current - i));
})();
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function daysIn(month: string, year: string): number {
  if (!month) return 31;
  return new Date(Date.UTC(Number(year || 2000), Number(month), 0)).getUTCDate();
}

export function StepBirth({ state, onChange, errors }: { state: WizardState; onChange: (patch: Patch) => void; errors: Record<string, string> }) {
  const nameId = useId();
  const dateId = useId();
  const timeId = useId();
  const windowId = useId();
  const dayCount = daysIn(state.month, state.year);
  const t24 = time24(state);
  const indian = state.tradition === "indian";

  return (
    <div className="space-y-8">
      <FieldShell label="Full name of the person this report is about" htmlFor={nameId} error={errors["birth.subjectName"]} hint="This can be you or someone else. It appears on the report only.">
        <input
          id={nameId}
          className="input"
          autoComplete="name"
          maxLength={100}
          value={state.subjectName}
          onChange={(e) => onChange({ subjectName: e.target.value })}
          aria-invalid={Boolean(errors["birth.subjectName"])}
          aria-describedby={describedBy(nameId, true, errors["birth.subjectName"])}
        />
      </FieldShell>

      <fieldset aria-describedby={errors["birth.birthDate"] ? `${dateId}-error` : undefined}>
        <legend className="field-label">Date of birth</legend>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-3">
          <label className="sr-only" htmlFor={`${dateId}-d`}>
            Day
          </label>
          <select id={`${dateId}-d`} className="input" value={state.day} onChange={(e) => onChange({ day: e.target.value })} aria-invalid={Boolean(errors["birth.birthDate"])}>
            <option value="">Day</option>
            {Array.from({ length: dayCount }, (_, i) => String(i + 1)).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${dateId}-m`}>
            Month
          </label>
          <select id={`${dateId}-m`} className="input" value={state.month} onChange={(e) => onChange({ month: e.target.value })} aria-invalid={Boolean(errors["birth.birthDate"])}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${dateId}-y`}>
            Year
          </label>
          <select id={`${dateId}-y`} className="input" value={state.year} onChange={(e) => onChange({ year: e.target.value })} aria-invalid={Boolean(errors["birth.birthDate"])}>
            <option value="">Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {errors["birth.birthDate"] ? (
          <p id={`${dateId}-error`} className="field-error" role="alert">
            {errors["birth.birthDate"]}
          </p>
        ) : null}
      </fieldset>

      <ChoiceCards
        legend="How sure are you of the birth time?"
        name="timeCertainty"
        columns={3}
        value={state.timeCertainty}
        onChange={(v) => onChange({ timeCertainty: v, dstChoice: null, ...(v !== "approximate" ? { timeWindowMinutes: null } : {}) })}
        error={errors["birth.timeCertainty"]}
        options={[
          { value: "exact", title: "Exact", description: "From a birth certificate or hospital record." },
          { value: "approximate", title: "Approximate", description: "Roughly known, e.g. \"early morning, around 6\"." },
          { value: "unknown", title: "I don't know", description: "We will only use what holds true all day." },
        ]}
      />

      {state.timeCertainty && state.timeCertainty !== "unknown" ? (
        <fieldset>
          <legend className="field-label">{state.timeCertainty === "exact" ? "Birth time" : "Your best estimate of the birth time"}</legend>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <div>
              <label className="field-hint !mt-0 mb-1 block" htmlFor={`${timeId}-h`}>
                Hour
              </label>
              <select id={`${timeId}-h`} className="input" value={state.hour12} onChange={(e) => onChange({ hour12: e.target.value, dstChoice: null })} aria-invalid={Boolean(errors["birth.birthTime"])}>
                <option value="">--</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint !mt-0 mb-1 block" htmlFor={`${timeId}-m`}>
                Minute
              </label>
              <select id={`${timeId}-m`} className="input" value={state.minute} onChange={(e) => onChange({ minute: e.target.value, dstChoice: null })} aria-invalid={Boolean(errors["birth.birthTime"])}>
                <option value="">--</option>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint !mt-0 mb-1 block" htmlFor={`${timeId}-ampm`}>
                AM / PM
              </label>
              <select id={`${timeId}-ampm`} className="input" value={state.meridiem} onChange={(e) => onChange({ meridiem: e.target.value as WizardState["meridiem"], dstChoice: null })} aria-invalid={Boolean(errors["birth.birthTime"])}>
                <option value="">--</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <p className="field-hint" aria-live="polite">
            {t24 ? (
              <>
                You entered <strong>{`${state.hour12}:${state.minute} ${state.meridiem}`}</strong> = <strong>{t24}</strong> in 24-hour time, local time at the birthplace.
              </>
            ) : (
              "Use the local clock time at the birthplace, as written on the certificate. 12 AM is midnight; 12 PM is noon."
            )}
          </p>
          {errors["birth.birthTime"] ? (
            <p className="field-error" role="alert">
              {errors["birth.birthTime"]}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {state.timeCertainty === "approximate" ? (
        <FieldShell label="How far off could it be?" htmlFor={windowId} error={errors["birth.timeWindowMinutes"]} hint="We evaluate your chart across this whole window and flag anything that could change within it.">
          <select
            id={windowId}
            className="input sm:max-w-xs"
            value={state.timeWindowMinutes ?? ""}
            onChange={(e) => onChange({ timeWindowMinutes: e.target.value ? Number(e.target.value) : null })}
            aria-invalid={Boolean(errors["birth.timeWindowMinutes"])}
          >
            <option value="">Choose…</option>
            {TIME_WINDOW_OPTIONS.map((m) => (
              <option key={m} value={m}>
                ± {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </FieldShell>
      ) : null}

      {state.timeCertainty === "unknown" ? (
        <div className="rounded-xl border border-gold-400/60 bg-gold-200/30 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-night-900">What changes without a birth time</p>
          <p className="mt-1">
            {indian
              ? "Your Lagna (ascendant), house positions, the North Indian chart and exact dasha dates need a birth time, so they will be left out. Your Rasi and planetary signs are still calculated; if the Moon changed nakshatra that day, we will show both possibilities."
              : "Your Rising sign, Midheaven and houses need a birth time, so they will be left out. Planet signs and most aspects are still calculated; if the Moon changed sign that day, we will show both possibilities."}{" "}
            We never assume a time such as noon.
          </p>
        </div>
      ) : null}

      <PlaceSearch value={state.place} onChange={(place) => onChange({ place, dstChoice: null })} error={errors["birth.placeId"]} />
    </div>
  );
}
