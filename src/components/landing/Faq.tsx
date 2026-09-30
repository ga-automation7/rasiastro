import Link from "next/link";
import { COPY } from "@/content/site-copy";
import { MORE_FAQ, purchaseFaq, type FaqItem } from "@/content/faq";

/**
 * The questions people ask before buying, right after pricing, then the rest.
 * Native <details> elements: keyboard accessible, announced as expandable, working
 * without JavaScript, and fully crawlable. The same text feeds the FAQPage JSON-LD.
 */
function Item({ item }: { item: FaqItem }) {
  return (
    <details className="faq-item group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[1.03rem] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
        {item.q}
        <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-gold-600">
          <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
          <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90 group-open:scale-y-0" />
        </span>
      </summary>
      <div className="pb-5 pr-8 leading-relaxed text-muted">
        <p>{item.a}</p>
        {item.link ? (
          <p className="mt-2">
            <Link className="font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700" href={item.link.href}>
              {item.link.label}
            </Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function Faq({ typicalMinutes, maxHours }: { typicalMinutes: number; maxHours: number }) {
  const first = purchaseFaq(typicalMinutes, maxHours);
  return (
    <section id="faq" aria-labelledby="faq-heading" className="section bg-ivory-50 [border-block:1px_solid_var(--color-ivory-300)]">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div data-reveal className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Before you buy</p>
          <h2 id="faq-heading" className="h-section mt-4 text-ink-950">
            Questions, answered.
          </h2>
          <p className="mt-5 max-w-sm border-l-2 border-gold-400 pl-4 text-[0.98rem] leading-relaxed text-ink-800">{COPY.disclaimer}</p>
        </div>
        <div>
          <div className="divide-y divide-ivory-300 border-y border-ivory-300">
            {first.map((item) => (
              <Item key={item.q} item={item} />
            ))}
          </div>
          <h3 className="mt-10 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-muted">More questions</h3>
          <div className="mt-3 divide-y divide-ivory-300 border-y border-ivory-300">
            {MORE_FAQ.map((item) => (
              <Item key={item.q} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
