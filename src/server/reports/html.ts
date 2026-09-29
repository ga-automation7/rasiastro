/**
 * Minimal auto-escaping HTML templating. Every interpolated value is escaped unless
 * it is explicitly marked `raw()` (only for markup we generated ourselves). This is
 * what keeps AI output and customer text from ever becoming executable markup in
 * the web report or the PDF.
 */
const RAW = Symbol("raw-html");

export interface RawHtml {
  readonly [RAW]: true;
  readonly value: string;
}

export function raw(value: string): RawHtml {
  return { [RAW]: true, value };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Interpolation = string | number | RawHtml | null | undefined | false | Interpolation[];

function render(value: Interpolation): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(render).join("");
  if (typeof value === "object" && RAW in value) return value.value;
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: Interpolation[]): RawHtml {
  let out = strings[0] ?? "";
  values.forEach((value, i) => {
    out += render(value) + (strings[i + 1] ?? "");
  });
  return raw(out);
}

export function join(parts: RawHtml[], separator = ""): RawHtml {
  return raw(parts.map((p) => p.value).join(separator));
}
