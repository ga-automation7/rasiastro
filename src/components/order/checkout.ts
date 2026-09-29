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

/**
 * Opens payment for an order that already exists. The amount always comes from the
 * order stored on the server. On any problem the customer lands on the order page,
 * where payment can be retried without re-entering anything.
 */
export async function openPayment(orderId: string, navigate: (href: string) => void): Promise<void> {
  const checkout = await postJson<{ provider: "cashfree" | "demo"; paymentSessionId: string | null; redirectUrl: string | null; environment: string }>(`/api/orders/${orderId}/checkout`);
  if (!checkout.ok) {
    navigate(`/orders/${orderId}?payment=start_failed`);
    return;
  }
  if (checkout.data.provider === "cashfree" && checkout.data.paymentSessionId) {
    const { load } = await import("@cashfreepayments/cashfree-js");
    const cashfree = await load({ mode: checkout.data.environment === "production" ? "production" : "sandbox" });
    if (!cashfree) {
      navigate(`/orders/${orderId}?payment=start_failed`);
      return;
    }
    await cashfree.checkout({ paymentSessionId: checkout.data.paymentSessionId, redirectTarget: "_self" });
    return;
  }
  navigate(checkout.data.redirectUrl ?? `/orders/${orderId}`);
}
