"use client";

import { useId, useState } from "react";

export function RecoverForm() {
  const emailId = useId();
  const refId = useId();
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, reference }) });
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: { message: string } };
    setBusy(false);
    if (res.ok) setMessage(body.message ?? null);
    else setError(body.error?.message ?? "Please try again in a few minutes.");
  };

  if (message) {
    return (
      <p role="status" className="card p-5 text-[15px]">
        {message}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor={emailId} className="field-label">
          Email address used for the order
        </label>
        <input id={emailId} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor={refId} className="field-label">
          Order reference (optional)
        </label>
        <input id={refId} className="input" placeholder="RA-XXXXXXXX" value={reference} onChange={(e) => setReference(e.target.value)} />
        <p className="field-hint">Leave empty to receive links for your recent orders.</p>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-dark" disabled={busy}>
        {busy ? "Sending…" : "Email me fresh links"}
      </button>
    </form>
  );
}
