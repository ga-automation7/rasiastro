/** Always-visible notice in demo mode so no one mistakes it for the live shop. */
export function ModeBanner({ mode }: { mode: "demo" | "live" }) {
  if (mode !== "demo") return null;
  return (
    <div role="note" className="bg-gold-200 px-4 py-2 text-center text-sm font-semibold text-night-950">
      Demo mode — payments are simulated and reports use sample text. No real money is taken.
    </div>
  );
}
