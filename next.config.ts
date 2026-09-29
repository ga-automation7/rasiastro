import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Cashfree's hosted checkout is opened by its browser SDK (sdk.cashfree.com), which
// then navigates the whole tab to Cashfree. Everything else is served from our origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://sdk.cashfree.com https://*.cashfree.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://sdk.cashfree.com https://*.cashfree.com",
  "frame-src 'self' https://*.cashfree.com",
  "form-action 'self' https://*.cashfree.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const baseSecurityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

// Pages and APIs that carry customer data or access tokens: never index, never
// cache in shared caches, never leak the URL through the Referer header.
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The floating dev-tools badge overlaps form controls during mobile testing.
  devIndicators: false,
  reactStrictMode: true,
  // These packages load native binaries, WASM or large data files at runtime and
  // must not be bundled by Next.js.
  serverExternalPackages: ["@electric-sql/pglite", "@sparticuz/chromium", "puppeteer-core", "exceljs"],
  // The report pipeline (served to Inngest from /api/inngest) renders PDFs with a
  // serverless Chromium build and our bundled fonts; make sure both are deployed.
  outputFileTracingIncludes: {
    "/api/inngest": ["./node_modules/@sparticuz/chromium/bin/**", "./src/assets/fonts/**"],
    "/api/demo/**": ["./src/assets/fonts/**"],
    "/api/orders/**": ["./src/assets/fonts/**"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next.js 16 only serves qualities listed here: 82 for the hero artwork, 75 elsewhere.
    qualities: [75, 82],
    // Homepage artwork masters are at most 1672 px wide; no need for larger variants.
    deviceSizes: [640, 750, 828, 1080, 1280, 1672],
  },
  async redirects() {
    // The public sample report was retired; keep old links working.
    return [{ source: "/sample-report", destination: "/", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      { source: "/orders/:path*", headers: privateHeaders },
      { source: "/access", headers: privateHeaders },
      { source: "/recover", headers: privateHeaders.filter((h) => h.key !== "Cache-Control") },
      { source: "/demo/:path*", headers: privateHeaders },
      { source: "/api/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
