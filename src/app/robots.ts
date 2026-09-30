import type { MetadataRoute } from "next";
import { getEnv } from "@/server/config/env";
import { getSiteState } from "@/server/config/readiness";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  // Only the real shop is crawled; demo, sandbox and not-yet-open sites are not.
  if (getSiteState(env).kind !== "live") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/orders/", "/access", "/recover", "/api/", "/demo/", "/start", "/compatibility", "/admin"] }],
    sitemap: `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
  };
}
