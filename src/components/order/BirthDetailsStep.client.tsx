"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TraditionCode } from "@/config/languages";
import {
  APPROX_BLOCKS,
  DOB_MESSAGES,
  PRECISE_WINDOWS,
  approxBlockPatch,
  certaintyPatch,
  dobStatus,
  firstName,
  parseDateText,
  personalBirthErrors,
  selectedApproxBlock,
  timeComplete,
  validHour,
  validMinute,
} from "./birth-input";
import { MONTHS, time24, type BirthFieldsState } from "./person";
import { PlaceCombobox } from "./PlaceCombobox.client";

/**
 * The personal report's "birth details" step. Only the way details are entered is
 * new: it writes the same BirthFieldsState as before, so the order payload (subjectName,
 * birthDate, timeCertainty, birthTime, timeWindowMinutes, placeId) is unchanged.
 * Sections appear as the previous one is completed; a returning visitor sees all of
 * them. Nothing here is stored in the browser.
 */
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

function Reveal({ children }: { children: React.ReactNode }) {
  return <div className="step-reveal">{children}</div>;
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message: string | null | undefined }) {
  return message ? (
    <p id={id} className="field-error step-reveal" role="alert">
      {message}
    </p>
  ) : null;
}

/* ------------------------------------------------------------ segmented number input */

interface SegmentProps {
  id: string;
  value: string;
  placeholder: string;
  maxLength: number;
  label: string;
  invalid: boolean;
  describedBy?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDigits: (digits: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  widthCh: number;
}

function Segment({ id, value, placeholder, maxLength, label, invalid, describedBy, inputRef, onDigits, onKeyDown, onPaste, onBlur, widthCh }: SegmentProps) {
  return (
    <input
      ref={inputRef}
      id={id}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="next"
      placeholder={placeholder}
      maxLength={maxLength + 8}
      value={value}
      onChange={(e) => onDigits(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={onBlur}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className="segment-input"
      style={{ width: `${widthCh + 1}ch` }}
    />
  );
}

/* ------------------------------------------------------------ date of birth */

function DateOfBirth({
  value,
  onChange,
  labelId,
  error,
  onEnter,
  firstRef,
}: {
  value: BirthFieldsState;
  onChange: (patch: Partial<BirthFieldsState>) => void;
  labelId: string;
  error: string | null;
  onEnter: () => void;
  firstRef: React.RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const refs = [firstRef, monthRef, yearRef] as const;
  const status = dobStatus(value.day, value.month, value.year);
  const today = new Date().toISOString().slice(0, 10);
  // Finished but wrong: say so at once. Unfinished: wait for Continue.
  const liveError = status === "invalid" || status === "future" || status === "too_early" || status === "under_age" ? DOB_MESSAGES[status] : null;
  const shown = liveError ?? error;
  const errorId = `${id}-error`;

  const pad = (key: "day" | "month") => {
    if (/^[1-9]$/.test(value[key])) onChange({ [key]: value[key].padStart(2, "0") });
  };

  const setAll = (d: { day: string; month: string; year: string }) => {
    onChange({ day: d.day, month: d.month, year: d.year, dstChoice: null });
    requestAnimationFrame(() => yearRef.current?.focus());
  };

  const input = (index: 0 | 1 | 2, raw: string) => {
    // Typing or pasting a whole date into any segment fills all three.
    if (/[-/. ]/.test(raw) || raw.replace(/\D/g, "").length > (index === 2 ? 4 : 2)) {
      const parsed = parseDateText(raw);
      if (parsed) return setAll(parsed);
    }
    const digits = raw.replace(/\D/g, "").slice(0, index === 2 ? 4 : 2);
    const key = (["day", "month", "year"] as const)[index];
    onChange({ [key]: digits, dstChoice: null });
    // A typed separator ("3/") also moves on, the way people write dates.
    const separator = /[-/. ]$/.test(raw) && digits.length > 0;
    const advance =
      index === 0 ? separator || digits.length === 2 || (digits.length === 1 && Number(digits) > 3) : index === 1 ? separator || digits.length === 2 || (digits.length === 1 && Number(digits) > 1) : false;
    if (advance) requestAnimationFrame(() => refs[index + 1]!.current?.focus());
  };

  const keyDown = (index: 0 | 1 | 2, e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const key = (["day", "month", "year"] as const)[index];
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
      return;
    }
    if (e.key === "Backspace" && el.value === "" && index > 0) {
      e.preventDefault();
      const prevKey = (["day", "month", "year"] as const)[index - 1]!;
      onChange({ [prevKey]: value[prevKey].slice(0, -1) });
      refs[index - 1]!.current?.focus();
      return;
    }
    if (e.key === "ArrowLeft" && el.selectionStart === 0 && index > 0) {
      e.preventDefault();
      refs[index - 1]!.current?.focus();
      return;
    }
    if (e.key === "ArrowRight" && el.selectionStart === el.value.length && index < 2) {
      e.preventDefault();
      refs[index + 1]!.current?.focus();
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const [min, max, pad] = index === 0 ? [1, 31, 2] : index === 1 ? [1, 12, 2] : [1900, new Date().getFullYear(), 4];
      const current = Number(value[key]) || (e.key === "ArrowUp" ? min - 1 : max + 1);
      const next = Math.min(max, Math.max(min, current + (e.key === "ArrowUp" ? 1 : -1)));
      onChange({ [key]: String(next).padStart(pad, "0"), dstChoice: null });
    }
  };

  const paste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseDateText(e.clipboardData.getData("text"));
    if (parsed) {
      e.preventDefault();
      setAll(parsed);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  const isoValue = status === "ok" ? `${value.year}-${value.month.padStart(2, "0")}-${value.day.padStart(2, "0")}` : "";
  return (
    <div role="group" aria-labelledby={labelId}>
      <div className={`segment-field ${shown ? "is-invalid" : ""} ${status === "ok" ? "is-complete" : ""}`}>
        <Segment id={`${id}-d`} inputRef={firstRef} label="Day" placeholder="DD" maxLength={2} widthCh={2} value={value.day} invalid={Boolean(shown)} describedBy={shown ? errorId : `${id}-fmt`} onDigits={(v) => input(0, v)} onKeyDown={(e) => keyDown(0, e)} onPaste={paste} onBlur={() => pad("day")} />
        <span aria-hidden="true" className="segment-sep">
          /
        </span>
        <Segment id={`${id}-m`} inputRef={monthRef} label="Month" placeholder="MM" maxLength={2} widthCh={2} value={value.month} invalid={Boolean(shown)} describedBy={shown ? errorId : `${id}-fmt`} onDigits={(v) => input(1, v)} onKeyDown={(e) => keyDown(1, e)} onPaste={paste} onBlur={() => pad("month")} />
        <span aria-hidden="true" className="segment-sep">
          /
        </span>
        <Segment id={`${id}-y`} inputRef={yearRef} label="Year" placeholder="YYYY" maxLength={4} widthCh={4} value={value.year} invalid={Boolean(shown)} describedBy={shown ? errorId : `${id}-fmt`} onDigits={(v) => input(2, v)} onKeyDown={(e) => keyDown(2, e)} onPaste={paste} />
        <span className="ml-auto flex items-center">
          <button type="button" onClick={openPicker} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ivory-200 hover:text-ink-900" aria-label="Open a calendar">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
            <input
              ref={pickerRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              min="1900-01-01"
              max={today}
              value={isoValue}
              onChange={(e) => {
                const parsed = parseDateText(e.target.value);
                if (parsed) setAll(parsed);
              }}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            />
          </button>
        </span>
      </div>
      <p id={`${id}-fmt`} className="sr-only">
        Day, month, then year. You can also paste a date such as 07/10/2003.
      </p>
      {status === "ok" ? (
        <p className="step-reveal mt-2 flex items-center gap-1.5 text-sm font-medium text-teal-700" aria-live="polite">
          <Check className="h-4 w-4" />
          {Number(value.day)} {MONTHS[Number(value.month) - 1]} {value.year} · Date recognised
        </p>
      ) : null}
      <FieldError id={errorId} message={shown} />
    </div>
  );
}

/* ------------------------------------------------------------ time */

function TimeEntry({
  value,
  onChange,
  label,
  hourRef,
  invalid,
  describedBy,
  onEnter,
}: {
  value: BirthFieldsState;
  onChange: (patch: Partial<BirthFieldsState>) => void;
  label: string;
  hourRef: React.RefObject<HTMLInputElement | null>;
  invalid: boolean;
  describedBy?: string;
  onEnter?: () => void;
}) {
  const id = useId();
  const minuteRef = useRef<HTMLInputElement>(null);
  const labelId = `${id}-label`;
  const hourInvalid = value.hour12 !== "" && !validHour(value.hour12);
  const minuteInvalid = value.minute !== "" && !validMinute(value.minute);

  const onHour = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    onChange({ hour12: digits, dstChoice: null });
    if (digits.length === 2 || (digits.length === 1 && Number(digits) > 1)) requestAnimationFrame(() => minuteRef.current?.focus());
  };
  const onMinute = (raw: string) => onChange({ minute: raw.replace(/\D/g, "").slice(0, 2), dstChoice: null });
  const keys = (which: "hour" | "minute") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter?.();
    } else if (which === "minute" && e.key === "Backspace" && el.value === "") {
      e.preventDefault();
      onChange({ hour12: value.hour12.slice(0, -1) });
      hourRef.current?.focus();
    } else if (which === "hour" && e.key === "ArrowRight" && el.selectionStart === el.value.length) {
      e.preventDefault();
      minuteRef.current?.focus();
    } else if (which === "minute" && e.key === "ArrowLeft" && el.selectionStart === 0) {
      e.preventDefault();
      hourRef.current?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const up = e.key === "ArrowUp";
      if (which === "hour") {
        const h = Number(value.hour12) || (up ? 0 : 13);
        onChange({ hour12: String(Math.min(12, Math.max(1, h + (up ? 1 : -1)))), dstChoice: null });
      } else {
        const m = value.minute === "" ? (up ? -1 : 60) : Number(value.minute);
        onChange({ minute: String(Math.min(59, Math.max(0, m + (up ? 1 : -1)))).padStart(2, "0"), dstChoice: null });
      }
    }
  };
  const t24 = timeComplete(value) ? time24(value) : null;

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="field-label">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`segment-field !w-auto ${invalid || hourInvalid || minuteInvalid ? "is-invalid" : ""} ${t24 ? "is-complete" : ""}`}>
          <Segment id={`${id}-h`} inputRef={hourRef} label="Hour" placeholder="hh" maxLength={2} widthCh={2} value={value.hour12} invalid={invalid || hourInvalid} describedBy={describedBy} onDigits={onHour} onKeyDown={keys("hour")} />
          <span aria-hidden="true" className="segment-sep">
            :
          </span>
          <Segment id={`${id}-m`} inputRef={minuteRef} label="Minute" placeholder="mm" maxLength={2} widthCh={2} value={value.minute} invalid={invalid || minuteInvalid} describedBy={describedBy} onDigits={onMinute} onKeyDown={keys("minute")} />
        </div>
        <div role="radiogroup" aria-label="AM or PM" className="inline-flex rounded-xl border border-ivory-300 bg-ivory-100 p-1">
          {(["AM", "PM"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={value.meridiem === m}
              onClick={() => onChange({ meridiem: m, dstChoice: null })}
              className={`min-h-11 min-w-14 rounded-lg px-4 text-sm font-semibold tracking-wide transition-all duration-200 ${value.meridiem === m ? "bg-ink-900 text-ivory-50 shadow-sm" : "text-ink-700 hover:bg-ivory-200"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="field-hint" aria-live="polite">
        {t24 ? (
          <>
            {`${Number(value.hour12)}:${value.minute.padStart(2, "0")} ${value.meridiem}`} is <strong>{t24}</strong> in 24 hour time, local time at the birthplace.
          </>
        ) : hourInvalid || minuteInvalid ? (
          <span className="font-semibold text-danger">Hours run from 1 to 12 and minutes from 00 to 59.</span>
        ) : (
          "12 AM is midnight and 12 PM is noon."
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ certainty tiles */

const CERTAINTY = [
  {
    value: "exact",
    title: "Exact time",
    body: "I know the time fairly precisely.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 1.8" />
      </>
    ),
  },
  {
    value: "approximate",
    title: "Approximate",
    body: "I know roughly when it was.",
    icon: (
      <>
        <path d="M3 16.5h18" />
        <path d="M6.5 16.5a5.5 5.5 0 0 1 11 0" />
        <path d="M12 5.5v2.5M5.8 8.3l1.7 1.7M18.2 8.3l-1.7 1.7" />
      </>
    ),
  },
  {
    value: "unknown",
    title: "Not sure",
    body: "I don't know the time.",
    icon: (
      <>
        <ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-20 12 12)" />
        <circle cx="12" cy="12" r="2.2" />
      </>
    ),
  },
] as const;

/* ------------------------------------------------------------ the step */

export function BirthDetailsStep({
  value,
  onChange,
  errors,
  tradition,
}: {
  value: BirthFieldsState;
  onChange: (patch: Partial<BirthFieldsState>) => void;
  errors: Record<string, string>;
  tradition: TraditionCode | null;
}) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const certaintyRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLInputElement>(null);
  // True while a click or tap is choosing an option (keyboard use clears it).
  const pointerChoice = useRef(false);
  const [precise, setPrecise] = useState(() => value.timeCertainty === "approximate" && timeComplete(value) && selectedApproxBlock(value) === null);

  // Errors are shown only while they still apply, with the current wording.
  const live = personalBirthErrors(value);
  const err = (key: string) => (errors[`birth.${key}`] ? (live[`birth.${key}`] ?? null) : null);

  const name = firstName(value.subjectName);
  const nameOk = value.subjectName.trim().length >= 2;
  const dob = dobStatus(value.day, value.month, value.year);
  const block = selectedApproxBlock(value);
  const timeReady =
    value.timeCertainty === "unknown" ||
    (value.timeCertainty === "exact" && timeComplete(value)) ||
    (value.timeCertainty === "approximate" && Boolean(value.timeWindowMinutes) && timeComplete(value));

  // Progressive reveal; anything already filled in (going Back, or a prefilled order) stays visible.
  const showDob = nameOk || Boolean(value.day || value.month || value.year) || Boolean(errors["birth.birthDate"]);
  const showCertainty = dob === "ok" || value.timeCertainty !== null || Boolean(errors["birth.timeCertainty"]);
  const showPlace = timeReady || value.place !== null || Boolean(errors["birth.placeId"]);

  // Bring the first control that needs attention into view when Continue finds a problem.
  useEffect(() => {
    const first = ["subjectName", "birthDate", "timeCertainty", "birthTime", "timeWindowMinutes", "placeId"].find((k) => errors[`birth.${k}`]);
    const target =
      first === "subjectName" ? nameRef : first === "birthDate" ? dayRef : first === "timeCertainty" ? certaintyRef : first === "birthTime" ? hourRef : first === "timeWindowMinutes" ? chipRef : first === "placeId" ? placeRef : null;
    if (target?.current) target.current.focus({ preventScroll: false });
  }, [errors]);

  const chooseCertainty = (next: NonNullable<BirthFieldsState["timeCertainty"]>) => {
    if (next === value.timeCertainty) return;
    onChange(certaintyPatch(next));
    setPrecise(false);
    // After a click or tap, move on to what comes next (keyboard users keep arrowing through the options).
    if (pointerChoice.current) {
      pointerChoice.current = false;
      requestAnimationFrame(() => {
        const target = next === "exact" ? hourRef.current : next === "approximate" ? chipRef.current : placeRef.current;
        if (!target) return;
        if (finePointer()) target.focus();
        else target.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  };

  const dobLabelId = `${id}-dob`;
  const timeErrorId = `${id}-time-error`;
  const certaintyErrorId = `${id}-certainty-error`;
  const approxErrorId = `${id}-approx-error`;

  return (
    <div className="space-y-10">
      {/* 1. Name */}
      <div>
        <label htmlFor={`${id}-name`} className="step-label">
          Who is this reading for?
        </label>
        <input
          ref={nameRef}
          id={`${id}-name`}
          className="input input-lg"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={100}
          placeholder="Enter their name"
          value={value.subjectName}
          onChange={(e) => onChange({ subjectName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (nameOk) requestAnimationFrame(() => dayRef.current?.focus());
            }
          }}
          aria-invalid={Boolean(err("subjectName"))}
          aria-describedby={`${id}-name-hint${err("subjectName") ? ` ${id}-name-error` : ""}`}
        />
        <div id={`${id}-name-hint`} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.86rem] text-muted">
          <span>Only used to personalise your report.</span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-gold-600" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="3" y="7" width="10" height="7" rx="1.6" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            Your name is not sent to the AI.
          </span>
        </div>
        <FieldError id={`${id}-name-error`} message={err("subjectName")} />
      </div>

      {/* 2. Date of birth */}
      {showDob ? (
        <Reveal>
          <p id={dobLabelId} className="step-label">
            {name ? (
              <>
                Now tell us when <span className="text-ink-700">{name}</span> was born.
              </>
            ) : (
              "Date of birth"
            )}
          </p>
          <DateOfBirth value={value} onChange={onChange} labelId={dobLabelId} error={err("birthDate")} firstRef={dayRef} onEnter={() => certaintyRef.current?.focus()} />
        </Reveal>
      ) : null}

      {/* 3. Birth time certainty */}
      {showCertainty ? (
        <Reveal>
          <fieldset aria-describedby={`${id}-certainty-sub${err("timeCertainty") ? ` ${certaintyErrorId}` : ""}`}>
            <legend className="step-label">Do you know the birth time?</legend>
            <p id={`${id}-certainty-sub`} className="-mt-1 mb-4 text-[0.95rem] text-muted">
              Even an approximate time can help.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CERTAINTY.map((c, i) => {
                const checked = value.timeCertainty === c.value;
                return (
                  <label key={c.value} className={`choice-tile ${checked ? "is-checked" : ""}`} onPointerDown={() => (pointerChoice.current = true)} onKeyDown={() => (pointerChoice.current = false)}>
                    <input
                      ref={i === 0 ? certaintyRef : undefined}
                      type="radio"
                      name="birth.timeCertainty"
                      value={c.value}
                      checked={checked}
                      onChange={() => chooseCertainty(c.value)}
                      className="sr-only"
                    />
                    <span className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-y-4">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-7 w-7 transition-colors duration-200 ${checked ? "text-gold-600" : "text-ink-600"}`} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                        {c.icon}
                      </svg>
                      <span className="sm:order-last sm:col-span-2">
                        <span className="block font-semibold text-ink-900">{c.title}</span>
                        <span className="mt-0.5 block text-sm leading-snug text-muted sm:mt-1">{c.body}</span>
                      </span>
                      <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${checked ? "scale-100 bg-ink-900 text-ivory-50" : "scale-75 border border-ivory-300 bg-transparent text-transparent"}`}>
                        <Check className="h-3 w-3" />
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldError id={certaintyErrorId} message={err("timeCertainty")} />
          </fieldset>
        </Reveal>
      ) : null}

      {/* 4. The time, as it applies */}
      {value.timeCertainty === "exact" ? (
        <Reveal>
          <div className="rounded-2xl border border-ivory-300/80 bg-ivory-100/60 p-5 sm:p-6">
            <TimeEntry value={value} onChange={onChange} label="Birth time" hourRef={hourRef} invalid={Boolean(err("birthTime"))} describedBy={err("birthTime") ? timeErrorId : undefined} onEnter={() => placeRef.current?.focus()} />
            <p className="mt-1 text-[0.86rem] text-muted">Use the time from a birth certificate or hospital record if available.</p>
            <FieldError id={timeErrorId} message={err("birthTime")} />
          </div>
        </Reveal>
      ) : null}

      {value.timeCertainty === "approximate" ? (
        <Reveal>
          <div className="rounded-2xl border border-ivory-300/80 bg-ivory-100/60 p-5 sm:p-6">
            <fieldset aria-describedby={err("timeWindowMinutes") ? approxErrorId : undefined}>
              <legend className="field-label">Roughly when?</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {APPROX_BLOCKS.map((b, i) => {
                  const checked = !precise && block === b.key;
                  return (
                    <label key={b.key} className={`chip-tile ${checked ? "is-checked" : ""}`}>
                      <input
                        ref={i === 0 ? chipRef : undefined}
                        type="radio"
                        name="birth.approxBlock"
                        value={b.key}
                        checked={checked}
                        onChange={() => {
                          setPrecise(false);
                          onChange(approxBlockPatch(b.key));
                        }}
                        className="sr-only"
                      />
                      <span className="block text-[0.95rem] font-semibold text-ink-900">{b.label}</span>
                      <span className="block text-xs text-muted">{b.range}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="mt-3 text-[0.84rem] text-muted">Each option covers its whole four hour span, and your report says which details could change within it.</p>

            {!precise ? (
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700"
                onClick={() => {
                  setPrecise(true);
                  onChange({ hour12: "", minute: "", meridiem: "", timeWindowMinutes: null, dstChoice: null });
                  requestAnimationFrame(() => hourRef.current?.focus());
                }}
              >
                Know it a little more precisely?
              </button>
            ) : (
              <div className="step-reveal mt-5 space-y-4 border-t border-ivory-300/80 pt-5">
                <TimeEntry value={value} onChange={onChange} label="Your best estimate" hourRef={hourRef} invalid={false} onEnter={() => chipRef.current?.focus()} />
                <fieldset>
                  <legend className="field-label">How far off could it be?</legend>
                  <div className="flex flex-wrap gap-2">
                    {PRECISE_WINDOWS.map((m) => (
                      <label key={m} className={`chip-tile !min-h-10 !px-3 !py-2 ${value.timeWindowMinutes === m ? "is-checked" : ""}`}>
                        <input type="radio" name="birth.timeWindowMinutes" value={m} checked={value.timeWindowMinutes === m} onChange={() => onChange({ timeWindowMinutes: m, dstChoice: null })} className="sr-only" />
                        <span className="text-sm font-semibold text-ink-900">± {m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  className="text-sm font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700"
                  onClick={() => {
                    setPrecise(false);
                    onChange({ hour12: "", minute: "", meridiem: "", timeWindowMinutes: null, dstChoice: null });
                  }}
                >
                  Use a time of day instead
                </button>
              </div>
            )}
            <FieldError id={approxErrorId} message={err("timeWindowMinutes") ? (precise && timeComplete(value) ? "Choose how far off it could be." : precise ? "Enter your best estimate of the time." : "Choose the closest option.") : null} />
          </div>
        </Reveal>
      ) : null}

      {value.timeCertainty === "unknown" ? (
        <Reveal>
          <div className="rounded-2xl border border-gold-300/70 bg-gold-100/50 p-5 text-[0.95rem] leading-relaxed">
            <p className="font-medium text-ink-900">That&apos;s okay. We&apos;ll only interpret what doesn&apos;t depend on an exact birth time.</p>
            <details className="group mt-2 text-sm text-ink-800">
              <summary className="cursor-pointer list-none font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 [&::-webkit-details-marker]:hidden">What changes without a time</summary>
              <p className="mt-2 text-muted">
                {tradition === "western"
                  ? "The Rising sign, Midheaven and houses need a birth time, so they are left out. Planet signs and most aspects are still calculated; if the Moon changed sign that day, both possibilities are shown."
                  : "The Lagna (Ascendant), house positions, the house based chart diagram and exact dasha dates need a birth time, so they are left out. The Rasi and planet signs are still calculated; if the Moon changed nakshatra that day, both possibilities are shown."}{" "}
                We never assume a time such as noon.
              </p>
            </details>
          </div>
        </Reveal>
      ) : null}

      {/* 5. Birthplace */}
      {showPlace ? (
        <Reveal>
          <PlaceCombobox
            value={value.place}
            onChange={(place) => onChange({ place, dstChoice: null })}
            inputRef={placeRef}
            label={name ? `Where was ${name} born?` : "Where were they born?"}
            error={err("placeId")}
          />
        </Reveal>
      ) : null}
    </div>
  );
}
