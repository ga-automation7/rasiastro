import Link from "next/link";

const CARDS = [
  {
    code: "indian",
    title: "Indian (Vedic) astrology",
    tagline: "Jyotisha, the sidereal tradition",
    points: [
      "Your Rasi, Nakshatram & pada and Lagna",
      "South Indian and North Indian chart diagrams",
      "Vimshottari dasha periods and Saturn/Jupiter transits",
      "Tamil, Kannada and North Indian presentation perspectives",
    ],
  },
  {
    code: "western",
    title: "Western astrology",
    tagline: "Sometimes called European astrology",
    points: [
      "Sun, Moon and Rising signs in the tropical zodiac",
      "Houses (Placidus) and major planetary aspects",
      "Modern psychological and traditional perspectives",
      "Current Saturn and Jupiter transits",
    ],
  },
] as const;

export function Traditions() {
  return (
    <section aria-labelledby="traditions-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Choose one tradition</p>
      <h2 id="traditions-heading" className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">
        Two traditions, one careful method
      </h2>
      <p className="mt-3 max-w-2xl text-muted">
        Each order covers one tradition. Your report language is a separate choice, so you can have an Indian report in English or a Western report in Tamil.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {CARDS.map((c) => (
          <article key={c.code} className="card flex flex-col p-6">
            <h3 className="text-2xl font-semibold text-night-900">{c.title}</h3>
            <p className="mt-1 text-sm text-gold-700">{c.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-[15px]">
              {c.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={`/start?tradition=${c.code}`} className="btn btn-dark mt-6 self-start">
              Start {c.code === "indian" ? "an Indian" : "a Western"} report
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
