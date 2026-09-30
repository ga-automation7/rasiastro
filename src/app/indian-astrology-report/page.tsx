import { FinalCta } from "@/components/landing/FinalCta";
import { ProductHero, ProductSections } from "@/components/landing/ProductPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { INDIAN_REPORT as copy } from "@/content/landing";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";
import { getReportPreview } from "@/server/reports/preview";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, productJsonLd } from "@/server/seo";

export const metadata = pageMetadata({ title: copy.metaTitle, description: copy.metaDescription, path: copy.path });

export default async function IndianReportPage() {
  const env = getEnv();
  const state = getSiteState(env);
  const preview = await getReportPreview();
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
      <style>{preview.chartCss}</style>
      <ProductHero
        copy={copy}
        available={state.products.personal.available}
        aside={
          <figure className="doc-page mx-auto w-[min(82vw,21rem)] rotate-[2deg] p-[1.4em] text-[14px] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e4d4b3] pb-[0.6em] text-[0.62em] font-semibold uppercase tracking-[0.18em] text-[#7a561a]">
              <span>Rasi Astro</span>
              <span>Sample chart</span>
            </div>
            <div className="report-web mx-auto mt-[0.8em] w-[92%] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: preview.chartSvg }} />
            <dl className="mt-[0.6em] divide-y divide-[#efe6d3] text-[0.66em]">
              {preview.glance.map((g) => (
                <div key={g.label} className="flex justify-between gap-2 py-[0.3em]">
                  <dt className="font-semibold text-[#1c2552]">{g.label}</dt>
                  <dd className="text-right text-[#3b3f58]">{g.value}</dd>
                </div>
              ))}
            </dl>
            <figcaption className="mt-[0.8em] text-[0.6em] text-[#5c6079]">South Indian layout, calculated for a fictional sample person.</figcaption>
          </figure>
        }
      />
      <ProductSections copy={copy} />
      <FinalCta personalAvailable={state.products.personal.available} compatibilityAvailable={state.products.compatibility.available} />
    </>
  );
}
