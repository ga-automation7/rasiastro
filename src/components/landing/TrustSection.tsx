import Link from "next/link";
import { POLICY_LINKS } from "@/config/site";
import { HOME } from "@/content/site-copy";
import { Glyph, type GlyphName } from "../site/Glyph";
import { SectionIntro, revealDelay } from "./ui";

/** Real trust cues only: how charts are made, AI disclosure, privacy, payment, support. */
export function TrustSection({ supportEmail }: { supportEmail: string }) {
  const t = HOME.trust;
  const r = HOME.recovery;
  return (
    <section id="trust" aria-labelledby="trust-heading" className="section scroll-mt-16 border-t border-ivory-300 bg-ivory-50">
      <div className="container-page">
        <SectionIntro id="trust-heading" eyebrow={t.eyebrow} lines={[t.headline]} />
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {t.points.map((pt, i) => (
            <li key={pt.title} className="border-t border-ink-900/15 pt-6" data-reveal style={revealDelay(i * 80)}>
              <Glyph name={pt.glyph as GlyphName} className="h-7 w-7 text-gold-600" />
              <h3 className="mt-4 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-ink-900">{pt.title}</h3>
              <p className="mt-2.5 text-[0.96rem] leading-relaxed text-muted">{pt.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-5 rounded-2xl bg-(--color-midnight) p-7 text-ivory-100 sm:flex-row sm:items-center sm:justify-between sm:p-9" data-reveal>
            <div className="max-w-xl">
              <p className="font-display text-2xl text-ivory-50">{r.title}</p>
              <p className="mt-2 text-[0.97rem] leading-relaxed text-ivory-300">{r.body}</p>
            </div>
            <Link href="/recover" className="btn shrink-0 border border-gold-300/50 px-6 text-ivory-50 hover:border-gold-200 hover:bg-white/5">
              {r.cta}
            </Link>
          </div>
          <div className="rounded-2xl border border-ivory-300 p-7 sm:p-9" data-reveal style={revealDelay(120)}>
            <p className="flex items-center gap-2.5 font-display text-xl text-ink-950">
              <Glyph name="mail" className="h-5 w-5 text-gold-600" />
              Talk to us
            </p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
              Questions or a problem with an order? Write to{" "}
              <a className="font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {POLICY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-ink-700 underline decoration-ink-700/25 underline-offset-4 hover:decoration-ink-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
