"use client";

import { useId } from "react";
import type { TraditionCode } from "@/config/languages";
import { TIME_WINDOW_OPTIONS } from "@/domain/order-input";
import { ChoiceCards, FieldShell, describedBy } from "./fields";
import { MONTHS, time24, type BirthFieldsState } from "./person";
import { PlaceSearch } from "./PlaceSearch.client";

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

/**
 * One person's birth details: name, date, time certainty, time, and birthplace.
 * Shared by the personal form (one person) and the compatibility form (each person).
 * `prefix` is the path used for this person's validation errors, e.g. "birth" or
 * "participants.1.birth", so two people's errors never mix.
 */
export function BirthFields({
  value,
  onChange,
  errors,
  prefix,
  tradition,
  nameLabel,
  nameHint,
}: {
  value: BirthFieldsState;
  onChange: (patch: Partial<BirthFieldsState>) => void;
  errors: Record<string, string>;
  prefix: string;
  tradition: TraditionCode | null;
  nameLabel: string;
  nameHint: string;
}) {
  const nameId = useId();
  const dateId = useId();
  const timeId = useId();
  const windowId = useId();
  const err = (field: string) => errors[`${prefix}.${field}`];
  const dayCount = daysIn(value.month, value.year);
  const t24 = time24(value);
  const indian = tradition === "indian";

  return (
    <div className="space-y-8">
      <FieldShell label={nameLabel} htmlFor={nameId} error={err("subjectName")} hint={nameHint}>
        <input
          id={nameId}
          className="input"
          autoComplete="off"
          maxLength={100}
          value={value.subjectName}
          onChange={(e) => onChange({ subjectName: e.target.value })}
          aria-invalid={Boolean(err("subjectName"))}
          aria-describedby={describedBy(nameId, true, err("subjectName"))}
        />
      </FieldShell>

      <fieldset aria-describedby={err("birthDate") ? `${dateId}-error` : undefined}>
        <legend className="field-label">Date of birth</legend>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-3">
          <label className="sr-only" htmlFor={`${dateId}-d`}>
            Day
          </label>
          <select id={`${dateId}-d`} className="input" value={value.day} onChange={(e) => onChange({ day: e.target.value })} aria-invalid={Boolean(err("birthDate"))}>
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
          <select id={`${dateId}-m`} className="input" value={value.month} onChange={(e) => onChange({ month: e.target.value })} aria-invalid={Boolean(err("birthDate"))}>
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
          <select id={`${dateId}-y`} className="input" value={value.year} onChange={(e) => onChange({ year: e.target.value })} aria-invalid={Boolean(err("birthDate"))}>
            <option value="">Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {err("birthDate") ? (
          <p id={`${dateId}-error`} className="field-error" role="alert">
            {err("birthDate")}
          </p>
        ) : null}
      </fieldset>

      <ChoiceCards
        legend="How sure are you of the birth time?"
        name={`${prefix}.timeCertainty`}
        columns={3}
        value={value.timeCertainty}
        onChange={(v) => onChange({ timeCertainty: v, dstChoice: null, ...(v !== "approximate" ? { timeWindowMinutes: null } : {}) })}
        error={err("timeCertainty")}
        options={[
          { value: "exact", title: "Exact", description: "From a birth certificate or hospital record." },
          { value: "approximate", title: "Approximate", description: "Roughly known, such as \"early morning, around 6\"." },
          { value: "unknown", title: "I don't know", description: "We use only what holds true all day." },
        ]}
      />

      {value.timeCertainty && value.timeCertainty !== "unknown" ? (
        <fieldset>
          <legend className="field-label">{value.timeCertainty === "exact" ? "Birth time" : "Best estimate of the birth time"}</legend>
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <div>
              <label className="field-hint !mt-0 mb-1 block" htmlFor={`${timeId}-h`}>
                Hour
              </label>
              <select id={`${timeId}-h`} className="input" value={value.hour12} onChange={(e) => onChange({ hour12: e.target.value, dstChoice: null })} aria-invalid={Boolean(err("birthTime"))}>
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
              <select id={`${timeId}-m`} className="input" value={value.minute} onChange={(e) => onChange({ minute: e.target.value, dstChoice: null })} aria-invalid={Boolean(err("birthTime"))}>
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
              <select
                id={`${timeId}-ampm`}
                className="input"
                value={value.meridiem}
                onChange={(e) => onChange({ meridiem: e.target.value as BirthFieldsState["meridiem"], dstChoice: null })}
                aria-invalid={Boolean(err("birthTime"))}
              >
                <option value="">--</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <p className="field-hint" aria-live="polite">
            {t24 ? (
              <>
                You entered <strong>{`${value.hour12}:${value.minute} ${value.meridiem}`}</strong>, which is <strong>{t24}</strong> in 24-hour time, local time at the birthplace.
              </>
            ) : (
              "Use the local clock time at the birthplace, as written on the certificate. 12 AM is midnight; 12 PM is noon."
            )}
          </p>
          {err("birthTime") ? (
            <p className="field-error" role="alert">
              {err("birthTime")}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {value.timeCertainty === "approximate" ? (
        <FieldShell label="How far off could it be?" htmlFor={windowId} error={err("timeWindowMinutes")} hint="We check the chart across this whole window and flag anything that could change within it.">
          <select
            id={windowId}
            className="input sm:max-w-xs"
            value={value.timeWindowMinutes ?? ""}
            onChange={(e) => onChange({ timeWindowMinutes: e.target.value ? Number(e.target.value) : null })}
            aria-invalid={Boolean(err("timeWindowMinutes"))}
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

      {value.timeCertainty === "unknown" ? (
        <div className="rounded-xl border border-gold-400/60 bg-gold-100 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-ink-900">What changes without a birth time</p>
          <p className="mt-1">
            {indian
              ? "The Lagna (Ascendant), house positions, the house-based chart diagram and exact dasha dates need a birth time, so they are left out. The Rasi and planet signs are still calculated; if the Moon changed nakshatra that day, both possibilities are shown."
              : "The Rising sign, Midheaven and houses need a birth time, so they are left out. Planet signs and most aspects are still calculated; if the Moon changed sign that day, both possibilities are shown."}{" "}
            We never assume a time such as noon.
          </p>
        </div>
      ) : null}

      <PlaceSearch value={value.place} onChange={(place) => onChange({ place, dstChoice: null })} error={err("placeId")} />
    </div>
  );
}
