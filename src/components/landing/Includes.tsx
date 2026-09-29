import Link from "next/link";

const ITEMS = [
  { title: "Calculated chart facts", body: "Planet positions, signs, nakshatras and houses are calculated from your birth time and place - never guessed by AI." },
  { title: "Clear conventions", body: "We state the zodiac, ayanamsa and house system used, and what changes if your birth time is uncertain." },
  { title: "Looking back", body: "Past dasha and transit periods, described as patterns you may recognise - never as claims about your life." },
  { title: "Looking ahead", body: "Current and upcoming periods with possible themes, opportunities and challenges." },
  { title: "Life areas", body: "Career, relationships, personal development and money themes, grounded in your chart." },
  { title: "One combined summary", body: "Where the perspectives agree and differ, brought together into practical takeaways." },
];

export function Includes() {
  return (
    <section aria-labelledby="includes-heading" className="bg-ivory-200/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow">What your report includes</p>
        <h2 id="includes-heading" className="mt-2 text-3xl font-semibold text-night-900 sm:text-4xl">
          Substantial, personal, honest
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((i) => (
            <div key={i.title} className="card p-5">
              <h3 className="text-lg font-semibold text-night-900">{i.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{i.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-night-900 p-6 text-ivory-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow !text-gold-300">Sample report</p>
            <p className="mt-1 text-lg">See exactly what you get - a complete sample for a fictional person, clearly labelled.</p>
          </div>
          <Link href="/sample-report" className="btn btn-primary shrink-0">
            Open the sample report
          </Link>
        </div>
      </div>
    </section>
  );
}
