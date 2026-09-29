const STEPS = [
  { title: "Choose", body: "Pick Indian or Western astrology and your report language." },
  { title: "Tell us your birth details", body: "Name, date, time (exact, approximate or unknown) and place. You can review everything before paying." },
  { title: "Add context (optional)", body: "Share what you already know about your chart and, for ₹20 more, ask three personal questions." },
  { title: "Pay securely", body: "Pay with UPI, cards or netbanking on Cashfree's secure page. We never see your card or UPI details." },
  { title: "Receive your report", body: "Watch your report being prepared, then read it online and download the PDF. We also email you a secure link." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <p className="eyebrow">How it works</p>
      <h2 id="how-heading" className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">
        Five short steps, no account
      </h2>
      <ol className="mt-8 grid gap-5 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-night-800 text-sm font-semibold text-ivory-50">{i + 1}</span>
            <h3 className="mt-3 text-lg font-semibold text-night-900">{s.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
