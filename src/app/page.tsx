import { JsonLd } from "@/components/seo/JsonLd";
import { CompatibilitySection } from "@/components/landing/CompatibilitySection";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LearnSection } from "@/components/landing/LearnSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { SampleReport } from "@/components/landing/SampleReport";
import { StickyCta } from "@/components/landing/StickyCta.client";
import { TraditionsLanguages } from "@/components/landing/TraditionsLanguages";
import { TrustSection } from "@/components/landing/TrustSection";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { MORE_FAQ, purchaseFaq } from "@/content/faq";
import { COPY, PRICE } from "@/content/site-copy";
import { faqJsonLd, organizationJsonLd, pageMetadata, productJsonLd, websiteJsonLd } from "@/server/seo";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";

/**
 * The homepage depends only on configuration, so it is rendered once per deployment
 * and served from the edge (no per-request server work).
 */
export const metadata = pageMetadata({ title: COPY.meta.title, description: COPY.meta.description, path: "/", absoluteTitle: true });

export default function HomePage() {
  const env = getEnv();
  const state = getSiteState(env);
  const personal = state.products.personal;
  const compatibility = state.products.compatibility;
  // One message when nothing can be ordered; per-product messages otherwise.
  const closedMessage = state.kind === "closed" ? state.banner?.text ?? null : null;
  const faqs = [...purchaseFaq(env.DELIVERY_TYPICAL_MINUTES, env.DELIVERY_MAX_HOURS), ...MORE_FAQ];
  return (
    <>
      <JsonLd data={[organizationJsonLd(env), websiteJsonLd(env), productJsonLd(env, "personal"), faqJsonLd(faqs)]} />
      <ScrollProgress />
      <Hero personalAvailable={personal.available} compatibilityAvailable={compatibility.available} closedMessage={closedMessage} />
      <HowItWorks />
      <LearnSection />
      <SampleReport available={personal.available} />
      <PricingSection personalAvailable={personal.available} typicalMinutes={env.DELIVERY_TYPICAL_MINUTES} maxHours={env.DELIVERY_MAX_HOURS} />
      <Faq typicalMinutes={env.DELIVERY_TYPICAL_MINUTES} maxHours={env.DELIVERY_MAX_HOURS} />
      <CompatibilitySection available={compatibility.available} pausedMessage={compatibility.message} />
      <TraditionsLanguages />
      <TrustSection supportEmail={env.SUPPORT_EMAIL} />
      <FinalCta personalAvailable={personal.available} compatibilityAvailable={compatibility.available} />
      {personal.available ? <StickyCta href="/start" label={`Get my report · ${PRICE.personal}`} note="Personal report" /> : null}
    </>
  );
}
