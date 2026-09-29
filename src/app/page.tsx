import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Includes } from "@/components/landing/Includes";
import { Pricing } from "@/components/landing/Pricing";
import { Traditions } from "@/components/landing/Traditions";
import { getCheckoutAvailability } from "@/server/config/readiness";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const availability = getCheckoutAvailability();
  return (
    <>
      <Hero ordersPausedMessage={availability.available ? null : availability.customerMessage} />
      <Traditions />
      <Includes />
      <HowItWorks />
      <Pricing />
      <Faq />
    </>
  );
}
