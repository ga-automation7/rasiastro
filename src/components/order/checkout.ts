"use client";

/** Browser helpers shared by the personal and compatibility order forms. */
export interface ApiErrorBody {
  code: string;
  message: string;
  fields: Record<string, string> | null;
}

export async function postJson<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "We couldn't reach Rasi Astro. Please check your connection and try again.", fields: null } };
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: ApiErrorBody };
  if (res.ok) return { ok: true, data };
  return { ok: false, status: res.status, error: data.error ?? { code: "unknown", message: "Something went wrong on our side. Please try again.", fields: null } };
}

/** Counts that someone started a form. No form data is sent. */
export function recordFormStarted(): void {
  void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "form_started" }) }).catch(() => undefined);
}

/** What the server returns from /api/orders/:id/checkout (no secrets). */
export interface CheckoutStart {
  provider: "cashfree" | "uropay" | "demo";
  paymentSessionId: string | null;
  redirectUrl: string | null;
  environment: string;
}

/**
 * Sends the browser to the checkout the server opened. Returns false if it could not
 * start. The payment result is never read from the browser: the order page asks the
 * server, which asks the provider.
 */
export async function goToCheckout(checkout: CheckoutStart, navigate: (href: string) => void): Promise<boolean> {
  if (checkout.provider === "cashfree" && checkout.paymentSessionId) {
    const { load } = await import("@cashfreepayments/cashfree-js");
    const cashfree = await load({ mode: checkout.environment === "production" ? "production" : "sandbox" });
    if (!cashfree) return false;
    await cashfree.checkout({ paymentSessionId: checkout.paymentSessionId, redirectTarget: "_self" });
    return true;
  }
  if (!checkout.redirectUrl) return false;
  if (checkout.redirectUrl.startsWith("https://")) {
    // A hosted checkout on the provider's site (UroPay): a full page load in this tab,
    // never a frame or popup, so phones can hand over to a UPI app from there.
    window.location.assign(checkout.redirectUrl);
    return true;
  }
  // Our own pages (the demo checkout, or the order page when nothing is left to pay).
  navigate(checkout.redirectUrl);
  return true;
}

/**
 * Opens payment for an order that already exists. The amount always comes from the
 * order stored on the server. On any problem the customer lands on the order page,
 * where payment can be retried without re-entering anything.
 */
export async function openPayment(orderId: string, navigate: (href: string) => void): Promise<void> {
  const checkout = await postJson<CheckoutStart>(`/api/orders/${orderId}/checkout`);
  if (!checkout.ok || !(await goToCheckout(checkout.data, navigate))) navigate(`/orders/${orderId}?payment=start_failed`);
}
