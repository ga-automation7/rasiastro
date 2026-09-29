import { useId } from "react";

/** Small, accessible form building blocks shared by the order steps. */
export function FieldShell({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export interface ChoiceOption<T extends string> {
  value: T;
  title: React.ReactNode;
  description?: React.ReactNode;
}

/** Radio group rendered as large tappable cards. */
export function ChoiceCards<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  error,
  columns = 2,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  error?: string | null;
  columns?: 2 | 3;
}) {
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className={`grid gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`card flex cursor-pointer gap-3 p-4 transition-colors ${checked ? "border-night-700 bg-white ring-2 ring-night-700" : "hover:border-night-600/50"}`}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="mt-1 h-4 w-4 accent-night-800" />
              <span>
                <span className="block font-semibold text-night-900">{o.title}</span>
                {o.description ? <span className="mt-1 block text-sm text-muted">{o.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
