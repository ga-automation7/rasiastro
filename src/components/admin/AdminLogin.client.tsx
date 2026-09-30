"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { postJson } from "../order/checkout";

/** Two steps: email, then the 6-digit code sent to it. */
export function AdminLogin() {
  const router = useRouter();
  const emailId = useId();
  const codeId = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ message: string }>("/api/admin/login/request", { email });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setMessage(res.data.message);
    setStep("code");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ ok: boolean }>("/api/admin/login/verify", { email, code });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return step === "email" ? (
    <form onSubmit={requestCode} className="space-y-4" noValidate>
      <div>
        <label htmlFor={emailId} className="field-label">
          Owner email
        </label>
        <input id={emailId} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-dark" disabled={busy || !email}>
        {busy ? "Sending…" : "Email me a sign-in code"}
      </button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-4" noValidate>
      {message ? (
        <p role="status" className="card p-4 text-sm">
          {message}
        </p>
      ) : null}
      <div>
        <label htmlFor={codeId} className="field-label">
          6-digit code
        </label>
        <input
          id={codeId}
          className="input tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-dark" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        <button type="button" className="btn btn-ghost text-ink-800" onClick={() => setStep("email")}>
          Use a different email
        </button>
      </div>
    </form>
  );
}

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost min-h-10 px-3 py-2 text-sm text-ink-800"
      onClick={async () => {
        await postJson("/api/admin/logout");
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
