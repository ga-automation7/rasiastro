import Link from "next/link";
import { COPY, PRICE } from "@/content/site-copy";

/**
 * Short, accurate answers. Delivery times come from configuration (set them from
 * measured live performance). Uses <details>, so it works without JavaScript.
 */
export function Faq({ typicalMinutes, maxHours }: { typicalMinutes: number; maxHours: number }) {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "Does this use AI?",
      a: "Yes. Our calculation engine works out your chart from your birth details. Our AI then writes the interpretation from that calculated chart, your chosen tradition and language, and any notes you add. It interprets your chart. It never calculates or invents it.",
    },
    {
      q: "Does a human astrologer review my report?",
      a: "No. Reports are calculated and written automatically, and no astrologer reviews them before delivery. Every report is checked automatically for structure, completeness and language. If anything looks wrong, write to us and we will look into it.",
    },
    {
      q: "What is included in my Jathagam?",
      a: "Your Rasi chart (D1) in both traditional layouts; your Lagna, Rasi, Nakshatra and pada; every planetary placement; your Vimshottari dasha periods and the Saturn and Jupiter transits that matter; and a written interpretation with Tamil, Kannada and Hindi regional perspectives and a closing summary. Divisional charts such as Navamsa (D9) are not included.",
    },
    {
      q: "What if I don't know my birth time?",
      a: "Choose \"I don't know\". We calculate only what holds true for the whole day, such as your Rasi and planet signs, and leave out what needs a time, such as the Lagna, houses and exact dasha dates. Where something could have changed during the day, we show every possibility rather than guess. Approximate times work the same way, across the window you choose.",
    },
    {
      q: "Can I choose Indian astrology in English?",
      a: "Yes. Tradition and language are separate choices: an Indian report in English, a Western report in Tamil, or any other combination.",
    },
    {
      q: "Which languages and regional perspectives are supported?",
      a: `${COPY.regional.languagesNote} ${COPY.regional.perspectivesNote} ${COPY.regional.notYet}`,
    },
    {
      q: "What does compatibility include?",
      a: `Both people's charts, the traditional factors or planetary contacts that matter for the connection you choose, and a written reading on communication, shared strengths, potential friction and the dynamics of your connection, with prompts to discuss together. It costs ${PRICE.compatibility} for the pair, with an online report and PDF. There is no compatibility score, and the report never tells anyone whether to marry, part ways or work together.`,
    },
    {
      q: "How do I receive my report?",
      a: (
        <>
          Once payment is confirmed, your report is prepared in the background, usually within about {typicalMinutes} minutes, and we aim to deliver it within {maxHours} hours. Follow it on your order
          page; we also email you a private link. The PDF downloads from your report page. No account is needed, and if you ever lose the link,{" "}
          <Link className="underline underline-offset-2" href="/recover">
            request a fresh one
          </Link>
          .
        </>
      ),
    },
    {
      q: "What if generation fails?",
      a: (
        <>
          We retry automatically, and a retry never costs you anything. If your report still cannot be completed, your order page will say so and show you how to reach us. We will then complete it or refund you under our{" "}
          <Link className="underline underline-offset-2" href="/refund-policy">
            Refund &amp; Cancellation policy
          </Link>
          .
        </>
      ),
    },
    {
      q: "How are birth details handled?",
      a: (
        <>
          We use them only to prepare and deliver your report. Your name, email, phone number and birthplace are never sent to the AI. Notes you add are shared with it, so it can take them into
          account. Your report opens only through your private link. See the{" "}
          <Link className="underline underline-offset-2" href="/privacy">
            Privacy Policy
          </Link>{" "}
          for retention and your rights.
        </>
      ),
    },
  ];

  return (
    <section id="faq" aria-labelledby="faq-heading" className="section scroll-mt-16">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div data-reveal>
          <h2 id="faq-heading" className="h-section text-ink-950">
            Questions, answered.
          </h2>
          <p className="mt-5 max-w-sm border-l-2 border-gold-400 pl-4 text-[0.98rem] leading-relaxed text-ink-800">{COPY.disclaimer}</p>
        </div>
        <div className="divide-y divide-ivory-300 border-y border-ivory-300">
          {items.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[1.05rem] font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-xl text-gold-600 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="pb-5 pr-8 leading-relaxed text-muted">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
