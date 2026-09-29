/**
 * Ornamental linework drawn for Rasi Astro: a thin rule with an eight-point star and
 * two small orbits. Decorative only (hidden from assistive technology); it draws
 * itself once when revealed and never loops.
 */
export function Ornament({ tone = "gold", className = "" }: { tone?: "gold" | "light"; className?: string }) {
  const stroke = tone === "gold" ? "var(--color-gold-500)" : "var(--color-gold-300)";
  return (
    <svg aria-hidden="true" viewBox="0 0 240 24" className={`h-6 w-60 max-w-full ${className}`} fill="none">
      <path className="ornament-line" pathLength={1} d="M4 12 H96" stroke={stroke} strokeWidth="1" />
      <path className="ornament-line" pathLength={1} d="M144 12 H236" stroke={stroke} strokeWidth="1" />
      <circle className="ornament-line" pathLength={1} cx="120" cy="12" r="9" stroke={stroke} strokeWidth="0.8" />
      <circle cx="104" cy="12" r="1.6" fill={stroke} />
      <circle cx="136" cy="12" r="1.6" fill={stroke} />
      <path d="M120 5 L121.6 10.4 L127 12 L121.6 13.6 L120 19 L118.4 13.6 L113 12 L118.4 10.4 Z" fill={stroke} />
    </svg>
  );
}
