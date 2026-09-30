import Link from "next/link";
import { Breadcrumbs } from "@/components/landing/ProductPage";
import { StarRule } from "@/components/landing/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { COPY, PRICE } from "@/content/site-copy";
import { getEnv } from "@/server/config/env";
import { breadcrumbJsonLd, organizationJsonLd, pageMetadata } from "@/server/seo";

export const metadata = pageMetadata({
  title: "About Rasi Astro: how our astrology reports are made",
  description: "How Rasi Astro calculates your birth chart, how AI interprets it, what we check, what we never do, and how to reach us.",
  path: "/about",
});

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "What we make",
    paragraphs: [
      `Rasi Astro makes personal astrology reports (${PRICE.personal}, or ${PRICE.personalWithQuestions} with three questions) and compatibility reports for two people (${PRICE.compatibility}). Each report follows one tradition, Indian (Vedic) or Western, and is written in one of six languages: Tamil, English, Hindi, Telugu, Kannada or Malayalam. You read it online and keep it as a PDF.`,
    ],
  },
  {
    heading: "How a report is made",
    paragraphs: [
      "First, your chart is calculated. Your birthplace is looked up in the GeoNames gazetteer, the historical time zone for that place and date is applied, and planetary positions are computed with Astronomy Engine, an open astronomical library. Indian charts use the sidereal zodiac with the Lahiri ayanamsa; Western charts use the tropical zodiac.",
      "Then AI writes the interpretation from those calculated positions, in the tradition and language you chose. It is given the chart, not your name, email, phone number or birthplace, and it refers to you only by a placeholder. It interprets the chart; it never calculates or invents planetary positions.",
      "Finally, every report is checked automatically for structure, completeness and language before it becomes your web report and PDF, and we email you a private link.",
    ],
  },
  {
    heading: "What we never do",
    paragraphs: [
      "No astrologer reviews reports before delivery, and we never suggest otherwise. We do not guarantee outcomes or present predictions as certainties. Compatibility reports carry no scores and never tell anyone whether to marry, part ways, hire each other or start a business. Reports are for adults: the person ordering and every person in a report must be 18 or older.",
      COPY.disclaimer,
    ],
  },
  {
    heading: "Your data",
    paragraphs: [
      "Birth details are used only to prepare and deliver your report. There are no customer accounts: each order opens only through its own private link, and a lost link can be sent again to the email you ordered with. We use no advertising or analytics trackers.",
    ],
  },
];

export default function AboutPage() {
  const env = getEnv();
  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(env),
          breadcrumbJsonLd(env, [
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <section aria-labelledby="page-heading" className="bg-(--color-midnight) text-ivory-100">
        <div className="container-page pb-16 pt-10 sm:pb-20">
          <Breadcrumbs
            trail={[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
            ]}
          />
          <p className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold-300">About Rasi Astro</p>
          <h1 id="page-heading" className="h-hero mt-4 max-w-3xl text-ivory-50 lg:text-[clamp(2.8rem,4.4vw,4.2rem)]">
            {COPY.campaign.map((line, i) => (
              <span key={line} className={`block ${i === 2 ? "text-gold-200" : ""}`}>
                {line}
              </span>
            ))}
          </h1>
        </div>
      </section>
      <div className="container-page max-w-3xl space-y-12 py-[var(--space-section)]">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-[length:var(--step-2)] leading-tight text-ink-950">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-4 text-[1.02rem] leading-[1.75] text-ink-800">
                {p}
              </p>
            ))}
          </section>
        ))}
        <section>
          <StarRule className="mb-10" />
          <h2 className="font-display text-[length:var(--step-2)] leading-tight text-ink-950">Who we are</h2>
          <p className="mt-4 text-[1.02rem] leading-[1.75] text-ink-800">
            {env.BUSINESS_LEGAL_NAME ? `Rasi Astro is operated by ${env.BUSINESS_LEGAL_NAME}${env.BUSINESS_ADDRESS ? `, ${env.BUSINESS_ADDRESS}` : ""}. ` : ""}
            Write to us at{" "}
            <a className="font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700" href={`mailto:${env.SUPPORT_EMAIL}`}>
              {env.SUPPORT_EMAIL}
            </a>
            , or see{" "}
            <Link className="font-semibold text-ink-700 underline decoration-ink-700/30 underline-offset-4 hover:decoration-ink-700" href="/contact">
              Contact and Grievance Redressal
            </Link>
            .
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.97rem]">
            {[
              { href: "/indian-astrology-report", label: "Indian astrology report" },
              { href: "/western-astrology-report", label: "Western astrology report" },
              { href: "/compatibility-report", label: "Compatibility report" },
              { href: "/#faq", label: "Questions, answered" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-700 underline decoration-ink-700/25 underline-offset-4 hover:decoration-ink-700">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
