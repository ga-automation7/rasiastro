import Link from "next/link";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is astrology scientifically proven?",
    a: "No. Astrology is an interpretive tradition, not scientifically validated prediction. Our reports are for reflection and self-understanding, written as possibilities rather than certainties.",
  },
  {
    q: "I don't know my exact birth time. Can I still order?",
    a: "Yes. Choose \"approximate\" or \"I don't know\". We calculate everything that holds for the whole possible time window, clearly mark facts that could have more than one value, and leave out time-sensitive parts such as the Lagna when they cannot be known. We never quietly assume a time.",
  },
  {
    q: "How are the charts calculated?",
    a: "Planet positions come from an astronomical calculation library, not from AI. Indian reports use the sidereal zodiac with the Lahiri ayanamsa and whole-sign houses; Western reports use the tropical zodiac with Placidus houses. The report states these conventions.",
  },
  {
    q: "What are the Tamil, Kannada and North Indian perspectives?",
    a: "They present the same calculated chart through regional naming, calendars (Tamil solar months; amanta and purnimanta lunar months) and chart layouts. They are interpretation perspectives, not different calculation systems.",
  },
  {
    q: "How do I receive my report? Do I need an account?",
    a: (
      <>
        No account is needed. After payment you can watch your report being prepared and then open it online. We also email you a secure link and the PDF is available to download. Lost the link?{" "}
        <Link className="underline" href="/recover">
          Request a fresh one
        </Link>
        .
      </>
    ),
  },
  {
    q: "Do you sell remedies, gemstones or rituals?",
    a: "No. We never ask for payments for remedies, and our reports avoid fear-based predictions. We do not predict illness, accidents or death, and we do not give investment advice.",
  },
  {
    q: "Is my data private?",
    a: (
      <>
        Your birth details are used only to prepare and deliver your report, and are deleted after the retention period described in our{" "}
        <Link className="underline" href="/privacy">
          privacy policy
        </Link>
        . We do not sell data or use it for advertising.
      </>
    ),
  },
  {
    q: "What if something goes wrong?",
    a: (
      <>
        If a report cannot be prepared after payment, we will fix it or refund you - see our{" "}
        <Link className="underline" href="/refund-policy">
          refund policy
        </Link>
        . You are never charged again because a report needs to be regenerated.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-6">
      <p className="eyebrow">FAQ</p>
      <h2 id="faq-heading" className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">
        Good questions
      </h2>
      <div className="mt-8 divide-y divide-ivory-300 border-y border-ivory-300">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-night-900">
              {item.q}
              <span aria-hidden="true" className="text-gold-600 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 leading-relaxed text-muted">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
