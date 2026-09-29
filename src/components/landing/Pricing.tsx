import Link from "next/link";
import { PRICING } from "@/config/pricing";
import { formatInr, quotePackage } from "@/domain/pricing";

export function Pricing() {
  const base = quotePackage(false);
  const withQuestions = quotePackage(true);
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="bg-night-950 text-ivory-100">
      <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <p className="eyebrow !text-gold-300">Pricing</p>
        <h2 id="pricing-heading" className="mt-2 text-3xl font-semibold text-ivory-50 sm:text-4xl">
          Simple, one-time prices
        </h2>
        <p className="mt-3 max-w-2xl text-ivory-300">The price you see is the price you pay. The PDF is always included. No subscription, no hidden charges.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-night-700 bg-night-900 p-6">
            <h3 className="text-xl font-semibold text-ivory-50">Report</h3>
            <p className="mt-3 font-display text-5xl text-gold-300">{formatInr(base.totalAmountPaise)}</p>
            <p className="mt-3 text-ivory-300">One Indian or Western report in your chosen language, online and as a PDF.</p>
          </div>
          <div className="rounded-2xl border border-gold-400/50 bg-night-900 p-6">
            <h3 className="text-xl font-semibold text-ivory-50">Report + three questions</h3>
            <p className="mt-3 font-display text-5xl text-gold-300">{formatInr(withQuestions.totalAmountPaise)}</p>
            <p className="mt-3 text-ivory-300">
              {formatInr(base.totalAmountPaise)} report + {formatInr(PRICING.questionsAddon.amountPaise)} for a bundle of {PRICING.questionsAddon.questionCount} personal questions,
              each answered in your report.
            </p>
          </div>
        </div>
        <Link href="/start" className="btn btn-primary mt-8">
          Get your report
        </Link>
      </div>
    </section>
  );
}
