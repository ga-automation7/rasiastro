import type { SiteState } from "@/server/config/readiness";

/**
 * One notice for the whole site, derived from the same state as the order buttons,
 * so the banner and the buttons can never say contradictory things.
 */
export function SiteBanner({ banner }: { banner: SiteState["banner"] }) {
  if (!banner) return null;
  const tone =
    banner.tone === "demo"
      ? "bg-gold-200 text-ink-950"
      : banner.tone === "sandbox"
        ? "bg-teal-100 text-teal-700"
        : "bg-ink-900 text-ivory-100";
  return (
    <div role="note" className={`px-4 py-2 text-center text-sm font-semibold ${tone}`}>
      {banner.text}
    </div>
  );
}
