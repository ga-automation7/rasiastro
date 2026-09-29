import Link from "next/link";
import { COPY } from "@/content/site-copy";

/** Three plain price cards. No discounts, countdowns, crossed-out prices or "popular" badges. */
export function Pricing({ personalAvailable, compatibilityAvailable }: { personalAvailable: boolean; compatibilityAvailable: boolean }) {
  const c = COPY.pricing;
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="section scroll-mt-16 bg-ivory-200/50">
      <div className="container-page">
        <div className="max-w-2xl" data-reveal>
          <h2 id="pricing-heading" className="h-section text-ink-950">
            {c.headline}
          </h2>
          <p className="lede mt-4">{c.supporting}</p>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {c.plans.map((p, i) => {
            const available = p.key === "compatibility" ? compatibilityAvailable : personalAvailable;
            return (
              <li key={p.key} className="card flex flex-col p-7" data-reveal style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}>
                <h3 className="font-display text-xl font-semibold text-ink-900">{p.title}</h3>
                <p className="mt-3 font-display text-5xl font-semibold tracking-tight text-ink-950">{p.price}</p>
                <p className="mt-4 flex-1 leading-relaxed text-muted">{p.body}</p>
                {available ? (
                  <Link href={p.href} className={`btn mt-6 ${p.key === "personal" ? "btn-primary" : "btn-outline"}`}>
                    {p.cta}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-muted" data-reveal>
          {c.footnote}
        </p>
      </div>
    </section>
  );
}
