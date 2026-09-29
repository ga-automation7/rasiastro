import { CompatibilitySection } from "@/components/landing/CompatibilitySection";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { Pricing } from "@/components/landing/Pricing";
import { CampaignBand, PersonalSection, RegionalSection, ReportSection, TechnologySection, TraditionsSection } from "@/components/landing/Stories";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const env = getEnv();
  const state = getSiteState(env);
  const personal = state.products.personal;
  const compatibility = state.products.compatibility;
  // One message when nothing can be ordered; per-product messages otherwise.
  const closedMessage = state.kind === "closed" ? state.banner?.text ?? null : null;
  return (
    <>
      <Hero personalAvailable={personal.available} compatibilityAvailable={compatibility.available} closedMessage={closedMessage} />
      <CampaignBand />
      <PersonalSection available={personal.available} />
      <TraditionsSection />
      <RegionalSection />
      <CompatibilitySection available={compatibility.available} pausedMessage={compatibility.message} />
      <TechnologySection />
      <ReportSection />
      <Pricing personalAvailable={personal.available} compatibilityAvailable={compatibility.available} />
      <Faq typicalMinutes={env.DELIVERY_TYPICAL_MINUTES} maxHours={env.DELIVERY_MAX_HOURS} />
    </>
  );
}
