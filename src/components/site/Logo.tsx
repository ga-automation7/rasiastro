/** Wordmark: "Rasi Astro" with an eight-point star. */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const ink = tone === "dark" ? "text-ink-900" : "text-ivory-50";
  return (
    <span className={`inline-flex items-center gap-2 font-display text-[1.35rem] font-semibold tracking-tight ${ink}`}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" className="text-gold-500">
        <polygon
          fill="currentColor"
          points="12,1 13.76,7.75 17.3,6.7 16.25,10.24 23,12 16.25,13.76 17.3,17.3 13.76,16.25 12,23 10.24,16.25 6.7,17.3 7.75,13.76 1,12 7.75,10.24 6.7,6.7 10.24,7.75"
        />
      </svg>
      Rasi Astro
    </span>
  );
}
