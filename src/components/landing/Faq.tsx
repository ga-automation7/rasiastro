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
      a: "Yes. Our calculation engine works out your chart from your birth details. AI then writes the interpretation from that calculated data, your chosen tradition and language, and any notes you add. The AI interprets your chart; it does not calculate or invent it.",
    },
    {
      q: "Does a human astrologer review my report?",
      a: "No. Reports are calculated and written automatically, and no astrologer reviews them before delivery. Each report is checked automatically for structure, completeness and language. If something looks wrong, write to us and we will look into it.",
    },
    {
      q: "What is included in my Jathagam?",
      a: "Your Indian report includes your Rasi chart (D1) in fixed-sign and house-based diagrams; your Lagna, Rasi, Nakshatra and pada; planetary placements; Vimshottari dasha periods and relevant Saturn and Jupiter transits; and a written interpretation with Tamil, Kannada and Hindi regional perspectives and a summary. Divisional charts such as Navamsa (D9) are not included.",
    },
    {
      q: "What if I don't know my birth time?",
      a: "Choose \"I don't know\". We calculate only what holds for the whole day, such as your Rasi and planet signs, and leave out what needs a time, such as the Lagna, houses and exact dasha dates. If something could have changed during the day, we show the possibilities instead of guessing. Approximate times work the same way across the window you choose.",
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
      a: `Both people's charts, the traditional factors or planetary contacts relevant to the connection you choose, and a written reading on communication, shared strengths, potential friction and category-specific dynamics, with prompts to discuss together. It costs ${PRICE.compatibility} for the pair, with an online report and PDF. There is no compatibility score, and the report does not tell anyone whether to marry, separate or work together.`,
    },
    {
      q: "How do I receive my report?",
      a: (
        <>
          After payment your report is prepared in the background, usually within about {typicalMinutes} minutes and at most within {maxHours} hours. You can follow it on your order page, and we email you a
          private link. The PDF is downloaded from your report page. No account is needed; if you lose the link,{" "}
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
          We retry automatically, and a retry never costs anything extra. If your report still cannot be completed, your order page says so and shows how to reach us; we then complete it or refund you under our{" "}
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
          We use them only to prepare and deliver your report. Your name, email, phone number and birthplace are not sent to the AI; notes you add are shared with it so it can take them into
          account. Reports open only through your private link. See the{" "}
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
