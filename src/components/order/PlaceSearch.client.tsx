"use client";

import { useEffect, useId, useRef, useState } from "react";
import { placeLabel, type PlaceOption } from "./wizard-state";

/**
 * Birthplace search. Results are shown as an explicit choice list: the customer must
 * pick one, which matters when several places share a name (Hyderabad, Salem...).
 * The chosen place determines coordinates and the historical time zone.
 */
export function PlaceSearch({ value, onChange, error }: { value: PlaceOption | null; onChange: (place: PlaceOption | null) => void; error?: string | null }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

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
        if (!res.ok) throw new Error(res.status === 429 ? "Too many searches - please wait a moment." : "Search is unavailable right now.");
        const body = (await res.json()) as { places: PlaceOption[] };
        setResults(body.places);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFetchError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searching]);

  if (value) {
    return (
      <div>
        <p className="field-label">Birthplace</p>
        <div className="card flex flex-wrap items-center justify-between gap-3 border-night-700 p-4">
          <div>
            <p className="font-semibold text-night-900">{placeLabel(value)}</p>
            <p className="text-sm text-muted">Time zone: {value.timezoneId} (historical rules for your birth date are applied automatically)</p>
          </div>
          <button type="button" className="btn btn-ghost px-3 py-2 text-sm text-night-800" onClick={() => onChange(null)}>
            Change place
          </button>
        </div>
      </div>
    );
  }

  const shown = searching ? results : null;
  const names = new Map<string, number>();
  shown?.forEach((r) => names.set(r.name.toLowerCase(), (names.get(r.name.toLowerCase()) ?? 0) + 1));
  const ambiguous = [...names.values()].some((n) => n > 1);

  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        Birthplace (city or town)
      </label>
      <input
        id={inputId}
        className="input"
        type="search"
        autoComplete="off"
        placeholder="Start typing, e.g. Madurai"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${inputId}-hint`}
      />
      <p id={`${inputId}-hint`} className="field-hint">
        Choose the matching place from the list. Village not listed? Pick the nearest town - a few kilometres make very little difference.
      </p>
      <div aria-live="polite" className="mt-2">
        {loading && searching ? <p className="text-sm text-muted">Searching…</p> : null}
        {fetchError ? <p className="field-error">{fetchError}</p> : null}
        {shown && shown.length === 0 && !loading ? <p className="text-sm text-muted">No matching places found. Try another spelling or a nearby town.</p> : null}
        {shown && shown.length > 0 ? (
          <fieldset className="mt-1">
            <legend className="mb-2 text-sm font-semibold text-night-900">
              {ambiguous ? "Several places share this name - please choose the right one:" : "Choose your birthplace:"}
            </legend>
            <ul className="space-y-2">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className="card w-full p-3 text-left hover:border-night-700" onClick={() => onChange(r)}>
                    <span className="block font-semibold text-night-900">{placeLabel(r)}</span>
                    <span className="block text-xs text-muted">{r.timezoneId}</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
