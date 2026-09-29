/** Public, non-secret site facts. Business contact details come from environment variables. */
export const SITE = {
  name: "Rasi Astro",
  domain: "rasiastro.com",
  tagline: "Your stars, your story.",
  description:
    "Personalised Indian (Vedic) and Western astrology reports calculated from your exact birth details, written in Tamil, English, Hindi, Telugu, Kannada or Malayalam. From ₹49, PDF included, no account needed.",
} as const;

export const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/sample-report", label: "Sample report" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const POLICY_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/refund-policy", label: "Refunds & cancellations" },
  { href: "/delivery-policy", label: "Delivery policy" },
  { href: "/contact", label: "Contact" },
] as const;
