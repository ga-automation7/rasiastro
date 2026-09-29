import type { MetadataRoute } from "next";
import { getEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().PUBLIC_SITE_URL.replace(/\/$/, "");
  return ["", "/start", "/compatibility", "/privacy", "/terms", "/refund-policy", "/delivery-policy", "/contact"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
  }));
}
