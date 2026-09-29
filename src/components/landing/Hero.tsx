import Link from "next/link";
import { REPORT_LANGUAGES } from "@/config/languages";
import { PRICING } from "@/config/pricing";
import { SITE } from "@/config/site";
import { formatInr } from "@/domain/pricing";
import { HeroMedia } from "../hero/HeroMedia.client";

export function Hero({ ordersPausedMessage }: { ordersPausedMessage: string | null }) {
  return (
    <HeroMedia>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <p className="eyebrow !text-gold-300">Indian · Western · Six languages</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-ivory-50 sm:text-6xl">{SITE.tagline}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ivory-200">
          A personalised astrology report calculated from your exact birth details and written in your language: Tamil, English, Hindi, Telugu, Kannada or Malayalam.
        </p>
        <p className="mt-2 text-sm text-ivory-300" lang="mul">
          {REPORT_LANGUAGES.map((l) => l.nativeName).join(" · ")}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/start" className="btn btn-primary text-base">
            Get your report · {formatInr(PRICING.report.amountPaise)}
          </Link>
          <Link href="/sample-report" className="btn btn-ghost text-ivory-50">
            See a sample report
          </Link>
        </div>
        <p className="mt-4 text-sm text-ivory-300">One-time payment · PDF included · No account or subscription</p>
        {ordersPausedMessage ? (
          <p role="status" className="mt-6 max-w-xl rounded-lg border border-gold-400/40 bg-night-900/70 px-4 py-3 text-sm text-gold-200">
            {ordersPausedMessage}
          </p>
        ) : null}
      </div>
    </HeroMedia>
  );
}
