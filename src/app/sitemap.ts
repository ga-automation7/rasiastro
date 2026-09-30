import type { MetadataRoute } from "next";
import { getEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

/** Public, indexable pages only (the order forms and private pages are left out). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().PUBLIC_SITE_URL.replace(/\/$/, "");
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/indian-astrology-report", priority: 0.9 },
    { path: "/western-astrology-report", priority: 0.9 },
    { path: "/compatibility-report", priority: 0.9 },
    { path: "/about", priority: 0.6 },
    { path: "/contact", priority: 0.4 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/refund-policy", priority: 0.3 },
    { path: "/delivery-policy", priority: 0.3 },
  ];
  return pages.map((p) => ({ url: `${base}${p.path}`, changeFrequency: "monthly", priority: p.priority }));
}
