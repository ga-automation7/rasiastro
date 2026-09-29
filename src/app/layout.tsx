import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteBanner } from "@/components/site/SiteBanner";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SITE } from "@/config/site";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";
import { fontVariables } from "./fonts";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  const state = getSiteState(env);
  return {
    metadataBase: new URL(env.PUBLIC_SITE_URL),
    title: { default: SITE.title, template: `%s · ${SITE.name}` },
    description: SITE.description,
    applicationName: SITE.name,
    openGraph: {
      title: SITE.title,
      description: SITE.description,
      siteName: SITE.name,
      type: "website",
      locale: "en_IN",
      images: [{ url: "/art/og-rasi-astro.jpg", width: 1200, height: 630, alt: "Rasi Astro" }],
    },
    twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/art/og-rasi-astro.jpg"] },
    // Only the real shop is indexed; demo, sandbox and not-yet-open sites are not.
    robots: state.kind === "live" ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a1523",
  width: "device-width",
  initialScale: 1,
};

/**
 * Scroll reveals: marks the page as JavaScript-enabled and reveals [data-reveal]
 * elements as they enter the viewport. Without JavaScript nothing is hidden.
 */
const REVEAL_SCRIPT = `(function(){var d=document.documentElement;if(!('IntersectionObserver' in window))return;d.classList.add('js');
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}});},{rootMargin:'0px 0px -6% 0px'});
var scan=function(){document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(function(el){io.observe(el);});};
if(document.readyState!=='loading')scan();else document.addEventListener('DOMContentLoaded',scan);
new MutationObserver(scan).observe(d,{childList:true,subtree:true});})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = getEnv();
  const state = getSiteState(env);
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <SiteBanner banner={state.banner} />
        <SiteHeader showOrderButton={state.products.personal.available} />
        <main id="main">{children}</main>
        <SiteFooter
          business={{
            legalName: env.BUSINESS_LEGAL_NAME ?? null,
            address: env.BUSINESS_ADDRESS ?? null,
            registration: env.BUSINESS_REGISTRATION ?? null,
            gstin: env.BUSINESS_GSTIN ?? null,
            supportEmail: env.SUPPORT_EMAIL,
            supportPhone: env.SUPPORT_PHONE ?? null,
          }}
        />
      </body>
    </html>
  );
}
