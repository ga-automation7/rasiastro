import type { MetadataRoute } from "next";
import { getEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  if (env.APP_MODE === "demo") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/orders/", "/access", "/recover", "/api/", "/demo/", "/start"] }],
    sitemap: `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
  };
}
