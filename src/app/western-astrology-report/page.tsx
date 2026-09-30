import { FinalCta } from "@/components/landing/FinalCta";
import { ProductHero, ProductSections } from "@/components/landing/ProductPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { WESTERN_REPORT as copy } from "@/content/landing";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, productJsonLd } from "@/server/seo";

export const metadata = pageMetadata({ title: copy.metaTitle, description: copy.metaDescription, path: copy.path });

/** A quiet zodiac wheel: twelve equal signs, as the tropical zodiac divides the ecliptic. */
function Wheel() {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className="mx-auto h-[min(72vw,20rem)] w-[min(72vw,20rem)] text-gold-300/70" fill="none" stroke="currentColor" strokeWidth="0.6">
      <circle cx="100" cy="100" r="92" />
      <circle cx="100" cy="100" r="74" />
      <circle cx="100" cy="100" r="40" strokeDasharray="1.5 3" />
      {ticks.map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <line key={deg} x1={100 + 74 * Math.cos(r)} y1={100 + 74 * Math.sin(r)} x2={100 + 92 * Math.cos(r)} y2={100 + 92 * Math.sin(r)} />;
      })}
      <path d="M100 26 L150 140 L42 92 Z" strokeOpacity="0.55" />
      <circle cx="100" cy="26" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="150" cy="140" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="42" cy="92" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function WesternReportPage() {
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
          productJsonLd(env, "personal"),
          faqJsonLd([...copy.faq]),
        ]}
      />
      <ProductHero copy={copy} available={state.products.personal.available} aside={<Wheel />} />
      <ProductSections copy={copy} />
      <FinalCta personalAvailable={state.products.personal.available} compatibilityAvailable={state.products.compatibility.available} />
    </>
  );
}
