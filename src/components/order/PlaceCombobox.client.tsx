"use client";

import { useEffect, useId, useRef, useState } from "react";
import { placeLabel, type PlaceOption } from "./person";

/**
 * Birthplace search for the personal form: an accessible combobox (ARIA 1.2 pattern)
 * over the same /api/places search as before. The visitor must choose a result, which
 * matters when several places share a name; the choice sets coordinates and the
 * historical time zone. Arrow keys, Enter and Escape work; results never cover the
 * input, and the field scrolls up on phones so the list stays above the keyboard.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-gold-200/70 px-px text-inherit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export function PlaceCombobox({
  value,
  onChange,
  inputRef,
  label,
  error,
}: {
  value: PlaceOption | null;
  onChange: (place: PlaceOption | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  error: string | null;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const controller = useRef<AbortController | null>(null);
  const chosenRef = useRef<HTMLDivElement>(null);

  const searching = !value && query.trim().length >= 2;

  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(async () => {
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`, { signal: c.signal });
        if (!res.ok) {
          throw new Error(res.status === 429 ? "Too many searches in a short time. Please wait a minute, then try again." : "We couldn't search places just now. Please try again in a moment.");
        }
        const body = (await res.json()) as { places: PlaceOption[] };
        setResults(body.places);
        setActive(body.places.length ? 0 : -1);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFetchError((e as Error).message);
      } finally {
        if (controller.current === c) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searching, attempt]);

  const choose = (place: PlaceOption) => {
    onChange(place);
    setOpen(false);
    setQuery("");
    setResults(null);
    // Focus rests quietly on the confirmed place; Tab then reaches "Change" and Continue.
    requestAnimationFrame(() => chosenRef.current?.focus({ preventScroll: true }));
  };

  if (value) {
    return (
      <div>
        <p className="step-label">{label}</p>
        <div ref={chosenRef} tabIndex={-1} className="step-reveal flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-600/35 bg-teal-100/40 px-4 py-3.5 outline-none">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-ivory-50">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-ink-900" aria-live="polite">
                {placeLabel(value)}
              </p>
              <p className="text-xs text-muted">Time zone {value.timezoneId}. Historical clock changes are applied automatically.</p>
            </div>
          </div>
          <button
            type="button"
            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700"
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const shown = searching && results ? results : null;
  const names = new Map<string, number>();
  shown?.forEach((r) => names.set(r.name.toLowerCase(), (names.get(r.name.toLowerCase()) ?? 0) + 1));
  const ambiguous = [...names.values()].some((n) => n > 1);
  const expanded = open && Boolean(shown && shown.length) && searching;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown || !shown.length) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = shown[active] ?? (shown.length === 1 ? shown[0] : undefined);
      if (pick && expanded) choose(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const status = loading ? "Searching…" : fetchError ? null : shown && shown.length === 0 ? "No matching places found. Try another spelling or a nearby town." : shown ? `${shown.length} place${shown.length === 1 ? "" : "s"} found. Use the arrow keys to choose.` : "";

  return (
    <div>
      <label htmlFor={`${id}-input`} className="step-label">
        {label}
      </label>
      <div className="relative">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-600" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21Z" />
          <circle cx="12" cy="9.8" r="2.3" />
        </svg>
        <input
          ref={inputRef}
          id={`${id}-input`}
          className="input input-lg !pl-12"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint ${id}-status${error ? ` ${id}-error` : ""}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Start typing a city or town…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            if (results?.length) setOpen(true);
            // On phones, lift the field so the suggestions stay above the keyboard.
            if (!window.matchMedia("(pointer: fine)").matches) {
              const el = e.currentTarget;
              setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {loading ? (
          <span aria-hidden="true" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ink-300 border-t-ink-700" />
        ) : null}
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching places"
          hidden={!expanded}
          className="place-panel absolute inset-x-0 top-full z-20 mt-2 max-h-[min(20rem,50svh)] overflow-y-auto rounded-2xl border border-ivory-300 bg-ivory-50 p-1.5 shadow-[0_24px_48px_-20px_rgb(10_21_35/0.35)]"
        >
          {ambiguous ? <li className="px-3 pb-1 pt-2 text-xs font-semibold text-gold-700">Several places share this name. Check the state and country.</li> : null}
          {shown?.map((r, i) => (
            <li
              key={r.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-ivory-200" : "hover:bg-ivory-100"}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <span>
                <span className="block font-semibold text-ink-900">
                  <Highlight text={r.name} query={query} />
                </span>
                <span className="block text-sm text-muted">{[r.region, r.country].filter(Boolean).join(", ")}</span>
              </span>
              <span className="hidden text-xs text-muted sm:block">{r.timezoneId}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-hint`} className="mt-2 flex items-start gap-1.5 text-[0.84rem] text-muted">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.2v4M8 4.9v.1" strokeLinecap="round" />
        </svg>
        Village not listed? Choose the nearest town. A few kilometres usually makes very little difference.
      </p>
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {searching ? status : ""}
      </p>
      {searching && !loading && shown && shown.length === 0 ? <p className="mt-2 text-sm text-muted">No matching places found. Try another spelling or a nearby town.</p> : null}
      {fetchError ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="field-error !mt-0">{fetchError}</p>
          <button type="button" className="text-sm font-semibold text-ink-700 underline underline-offset-2" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error step-reveal" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
