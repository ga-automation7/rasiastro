"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { COMPATIBILITY_CATEGORIES, type CompatibilityCategory } from "@/config/compatibility";

/**
 * Single-select connection category. Built on native radio inputs, so it is a proper
 * radio group for assistive technology, arrow keys move the selection, and it works
 * inside a plain <form> even before JavaScript loads. The moving highlight is purely
 * decorative (and skipped for reduced motion).
 */
export function CategorySelector({
  value,
  onChange,
  name = "category",
  tone = "light",
  legend,
  legendHidden = false,
  error,
}: {
  value: CompatibilityCategory | null;
  onChange?: (value: CompatibilityCategory) => void;
  name?: string;
  tone?: "light" | "dark";
  legend: string;
  legendHidden?: boolean;
  error?: string | null;
}) {
  const reduce = useReducedMotion();
  const group = useId();
  const selected = COMPATIBILITY_CATEGORIES.find((c) => c.key === value) ?? null;
  const dark = tone === "dark";

  return (
    <fieldset aria-describedby={`${group}-desc${error ? ` ${group}-error` : ""}`}>
      <legend className={legendHidden ? "sr-only" : `field-label ${dark ? "!text-ivory-100" : ""}`}>{legend}</legend>
      <LayoutGroup id={group}>
        <div className="flex flex-wrap gap-2">
          {COMPATIBILITY_CATEGORIES.map((c) => {
            const checked = value === c.key;
            return (
              <label
                key={c.key}
                className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-vermilion-500 ${
                  dark
                    ? checked
                      ? "text-ink-950"
                      : "text-ivory-100 ring-1 ring-ivory-100/35 hover:ring-gold-300"
                    : checked
                      ? "text-ivory-50"
                      : "text-ink-900 ring-1 ring-ink-800/25 hover:ring-ink-800/60"
                }`}
              >
                {checked ? (
                  <motion.span
                    layoutId={`${group}-pill`}
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-full ${dark ? "bg-gold-300" : "bg-ink-800"}`}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
                  />
                ) : null}
                <input
                  type="radio"
                  name={name}
                  value={c.key}
                  checked={checked}
                  onChange={() => onChange?.(c.key)}
                  className="sr-only"
                />
                <span className="relative">{c.label}</span>
              </label>
            );
          })}
        </div>
      </LayoutGroup>
      <p id={`${group}-desc`} aria-live="polite" className={`mt-3 min-h-6 text-[0.95rem] ${dark ? "text-ivory-200" : "text-muted"}`}>
        {selected ? selected.description : "Choose the kind of connection you want to understand."}
      </p>
      {error ? (
        <p id={`${group}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
