import { CURRENCY, PRICING } from "@/config/pricing";
import { SITE } from "@/config/site";
import type { FaqItem } from "@/content/faq";
import type { Env } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";

/**
 * schema.org JSON-LD for the public pages. Only facts the site states elsewhere:
 * no ratings, reviews or counts. Prices come from src/config/pricing.ts.
 */
const base = (env: Env) => env.PUBLIC_SITE_URL.replace(/\/$/, "");
const amount = (paise: number) => (paise / 100).toFixed(2);

export function organizationJsonLd(env: Env) {
  const url = base(env);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: SITE.name,
    url,
    logo: `${url}/icon.svg`,
    email: env.SUPPORT_EMAIL,
    ...(env.BUSINESS_LEGAL_NAME ? { legalName: env.BUSINESS_LEGAL_NAME } : {}),
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: env.SUPPORT_EMAIL, availableLanguage: ["English"] },
  };
}

export function websiteJsonLd(env: Env) {
  const url = base(env);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: SITE.name,
    url,
    inLanguage: "en-IN",
    publisher: { "@id": `${url}/#organization` },
  };
}

export function productJsonLd(env: Env, product: "personal" | "compatibility") {
  const url = base(env);
  const available = getSiteState(env).products[product].available;
  const offer = (name: string, paise: number, path: string) => ({
    "@type": "Offer",
    name,
    price: amount(paise),
    priceCurrency: CURRENCY,
    availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url: `${url}${path}`,
  });
  if (product === "personal") {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Personal astrology report",
      description:
        "A personal astrology report from your calculated birth chart, in Indian (Vedic) or Western astrology, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. Online report and PDF.",
      brand: { "@type": "Brand", name: SITE.name },
      offers: [
        offer("Personal report", PRICING.report.amountPaise, "/start"),
        offer("Personal report with three questions", PRICING.report.amountPaise + PRICING.questionsAddon.amountPaise, "/start?questions=1"),
      ],
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Astrology compatibility report",
    description: "A compatibility report comparing two birth charts for one connection: relationship, marriage, friendship, family, career and teamwork, or business partnership. Online report and PDF.",
    brand: { "@type": "Brand", name: SITE.name },
    offers: [offer("Compatibility report for two people", PRICING.compatibility.amountPaise, "/compatibility")],
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function breadcrumbJsonLd(env: Env, trail: { name: string; path: string }[]) {
  const url = base(env);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${url}${t.path}` })),
  };
}

/** Page metadata with its canonical URL and matching social previews. */
export function pageMetadata({ title, description, path, absoluteTitle = false }: { title: string; description: string; path: string; absoluteTitle?: boolean }) {
  const image = { url: "/art/og-card.jpg", width: 1200, height: 630, alt: "Rasi Astro: personal astrology reports" };
  const socialTitle = absoluteTitle ? title : `${title} · ${SITE.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: socialTitle, description, url: path, siteName: SITE.name, type: "website" as const, locale: "en_IN", images: [image] },
    twitter: { card: "summary_large_image" as const, title: socialTitle, description, images: [image.url] },
  };
}
