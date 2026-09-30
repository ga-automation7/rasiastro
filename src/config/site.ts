import { COPY } from "@/content/site-copy";

/** Public, non-secret site facts. Business contact details come from environment variables. */
export const SITE = {
  name: "Rasi Astro",
  domain: "rasiastro.com",
  title: COPY.meta.title,
  description: COPY.meta.description,
} as const;

export const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#report", label: "Your report" },
  { href: "/#compatibility", label: "Compatibility" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const POLICY_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund & Cancellation" },
  { href: "/delivery-policy", label: "Digital Delivery" },
  { href: "/contact", label: "Contact & Grievance Redressal" },
] as const;
