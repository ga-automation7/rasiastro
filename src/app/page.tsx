import { CompatibilitySection } from "@/components/landing/CompatibilitySection";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { EngineSection, IncludesSection, LanguagesSection, PriceSection, ReceiveSection, ScrollProgress, TraditionsSplit, TransparencySection } from "@/components/landing/Premium";
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
      <ScrollProgress />
      <Hero personalAvailable={personal.available} compatibilityAvailable={compatibility.available} closedMessage={closedMessage} />
      <EngineSection />
      <ReceiveSection available={personal.available} />
      <IncludesSection />
      <PriceSection personalAvailable={personal.available} />
      <CompatibilitySection available={compatibility.available} pausedMessage={compatibility.message} />
      <LanguagesSection />
      <TraditionsSplit />
      <TransparencySection />
      <Faq typicalMinutes={env.DELIVERY_TYPICAL_MINUTES} maxHours={env.DELIVERY_MAX_HOURS} />
    </>
  );
}
