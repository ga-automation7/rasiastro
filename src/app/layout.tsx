import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE } from "@/config/site";
import { ModeBanner } from "@/components/site/ModeBanner";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getEnv } from "@/server/config/env";
import { fontVariables } from "./fonts";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  return {
    metadataBase: new URL(env.PUBLIC_SITE_URL),
    title: { default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.name}` },
    description: SITE.description,
    applicationName: SITE.name,
    openGraph: { title: SITE.name, description: SITE.description, siteName: SITE.name, type: "website", locale: "en_IN" },
    robots: env.APP_MODE === "demo" ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#151238",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = getEnv();
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen antialiased">
        <ModeBanner mode={env.APP_MODE} />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter supportEmail={env.SUPPORT_EMAIL} />
      </body>
    </html>
  );
}
