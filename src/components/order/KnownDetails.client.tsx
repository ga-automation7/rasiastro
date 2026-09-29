"use client";

import { useId } from "react";
import type { TraditionCode } from "@/config/languages";
import { NAKSHATRA_KEYS, NAKSHATRA_NAMES_EN, SIGN_KEYS, SIGN_NAMES_EN, type NakshatraKey, type SignKey } from "@/domain/astrology/constants";
import { FieldShell } from "./fields";
import { hasKnownDetails, type KnownState } from "./person";

/**
 * "Know something about your chart?" - optional details the customer already knows.
 * Context only: the calculation always wins, and differences are explained kindly.
 */
export function KnownDetails({
  value,
  onChange,
  tradition,
  errors,
  prefix,
  title,
}: {
  value: KnownState;
  onChange: (patch: Partial<KnownState>) => void;
  tradition: TraditionCode | null;
  errors: Record<string, string>;
  prefix: string;
  title: string;
}) {
  const ids = { moon: useId(), nak: useId(), pada: useId(), asc: useId(), other: useId() };
  const indian = tradition === "indian";
  const signLabel = (s: SignKey) => (indian ? `${SIGN_NAMES_EN[s].sanskrit} (${SIGN_NAMES_EN[s].western})` : SIGN_NAMES_EN[s].western);
  const err = (field: string) => errors[`${prefix}.${field}`];

  return (
    <details className="card p-5" open={hasKnownDetails(value) || Object.keys(errors).some((k) => k.startsWith(prefix))}>
      <summary className="cursor-pointer text-lg font-semibold text-ink-900">
        {title} <span className="text-base font-normal text-muted">(optional)</span>
      </summary>
      <p className="mt-2 text-sm text-muted">
        Helpful context, never a replacement for our calculation. If what you know differs from what we calculate, the report shows both and explains why they can differ.
      </p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FieldShell label={indian ? "Rasi (Moon sign)" : "Moon sign"} htmlFor={ids.moon}>
          <select id={ids.moon} className="input" value={value.moonSign} onChange={(e) => onChange({ moonSign: e.target.value as SignKey | "" })}>
            <option value="">Not sure</option>
            {SIGN_KEYS.map((s) => (
              <option key={s} value={s}>
                {signLabel(s)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell label={indian ? "Lagna (Ascendant)" : "Rising sign (Ascendant)"} htmlFor={ids.asc}>
          <select id={ids.asc} className="input" value={value.ascendant} onChange={(e) => onChange({ ascendant: e.target.value as SignKey | "" })}>
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
            <FieldShell label="Nakshatra (birth star)" htmlFor={ids.nak}>
              <select id={ids.nak} className="input" value={value.nakshatra} onChange={(e) => onChange({ nakshatra: e.target.value as NakshatraKey | "" })}>
                <option value="">Not sure</option>
                {NAKSHATRA_KEYS.map((n) => (
                  <option key={n} value={n}>
                    {NAKSHATRA_NAMES_EN[n]}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell label="Pada" htmlFor={ids.pada} error={err("pada")}>
              <select id={ids.pada} className="input" value={value.pada} onChange={(e) => onChange({ pada: e.target.value })}>
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
        <FieldShell label="Other chart details you know" htmlFor={ids.other} error={err("otherDetails")} hint="For example: “Our family astrologer said I am in Rahu dasha.” Up to 500 characters.">
          <textarea id={ids.other} className="input min-h-20" maxLength={500} value={value.otherDetails} onChange={(e) => onChange({ otherDetails: e.target.value })} />
        </FieldShell>
      </div>
    </details>
  );
}
