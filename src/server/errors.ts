/**
 * Expected, user-facing failures. Anything else is an unexpected error: it is logged
 * and the customer sees a generic message with no internal detail.
 */
export type AppErrorCode =
  | "validation_failed"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "rate_limited"
  | "service_unavailable"
  | "payment_provider_error";

const STATUS: Record<AppErrorCode, number> = {
  validation_failed: 400,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  rate_limited: 429,
  service_unavailable: 503,
  payment_provider_error: 502,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: AppErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export const validationError = (message: string, fieldErrors?: Record<string, string>) =>
  new AppError("validation_failed", message, fieldErrors);
export const notFound = (message = "Not found") => new AppError("not_found", message);
// Unauthorised access to an order looks exactly like a missing order (no enumeration).
export const orderNotAccessible = () => new AppError("not_found", "We could not find that order, or this link has expired.");
export const conflict = (message: string) => new AppError("conflict", message);
export const rateLimited = (message = "Too many attempts. Please wait a few minutes and try again.") => new AppError("rate_limited", message);
export const serviceUnavailable = (message: string) => new AppError("service_unavailable", message);
