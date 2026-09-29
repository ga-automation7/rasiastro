/**
 * Structured JSON logs that are safe to ship to any log drain.
 *
 * Never log: access tokens, emails, phone numbers, names, birth data, questions,
 * report content, API keys or raw provider payloads. Sensitive-looking keys are
 * redacted automatically as a safety net, and free-text error messages are scrubbed
 * of email addresses, long digit runs and token-like strings.
 */
type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /(email|phone|token|secret|password|authorization|cookie|api[-_]?key|name|birth|question|context|content|payload|address|ip$)/i;
const SAFE_KEYS = new Set(["orderId", "reference", "paymentId", "providerOrderId", "step", "event", "outcome", "status", "provider", "model", "part", "durationMs", "attempt", "count", "language", "tradition", "mode", "code", "kind", "topic", "route", "keyName"]);

export function scrubText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 500);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value instanceof Error) return { name: value.name, message: scrubText(value.message) };
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = !SAFE_KEYS.has(k) && SENSITIVE_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error" && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...(sanitize(fields) as object) });
  if (level === "error" || level === "warn") console.error(line);
  else process.stdout.write(`${line}\n`);
}

export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, fields);
  },
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};
