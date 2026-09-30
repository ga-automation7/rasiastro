import { FinalCta } from "@/components/landing/FinalCta";
import { ProductHero, ProductSections } from "@/components/landing/ProductPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { COMPATIBILITY_REPORT as copy } from "@/content/landing";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, productJsonLd } from "@/server/seo";

export const metadata = pageMetadata({ title: copy.metaTitle, description: copy.metaDescription, path: copy.path });

/** Two orbits that overlap: two charts, one shared space. */
function Orbits() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 180" className="mx-auto w-[min(80vw,22rem)] text-gold-300/70" fill="none" stroke="currentColor" strokeWidth="0.7">
      <circle cx="90" cy="90" r="62" />
      <circle cx="150" cy="90" r="62" />
      <circle cx="90" cy="90" r="40" strokeDasharray="1.5 3" />
      <circle cx="150" cy="90" r="40" strokeDasharray="1.5 3" />
      <circle cx="90" cy="28" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="150" cy="152" r="2.6" fill="currentColor" stroke="none" />
      <path d="M120 36 L126 50 L140 54 L126 58 L120 72 L114 58 L100 54 L114 50 Z" fill="currentColor" stroke="none" opacity="0.8" transform="translate(0 36) scale(1 1)" />
    </svg>
  );
}

export default function CompatibilityReportPage() {
  const env = getEnv();
  const state = getSiteState(env);
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(env, [
            { name: "Home", path: "/" },
            { name: copy.crumb, path: copy.path },
          ]),
          productJsonLd(env, "compatibility"),
          faqJsonLd([...copy.faq]),
        ]}
      />
      <ProductHero copy={copy} available={state.products.compatibility.available} aside={<Orbits />} />
      <ProductSections copy={copy} />
      <FinalCta personalAvailable={state.products.personal.available} compatibilityAvailable={state.products.compatibility.available} />
    </>
  );
}
