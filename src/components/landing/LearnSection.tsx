import { COPY, HOME } from "@/content/site-copy";
import { Glyph, type GlyphName } from "../site/Glyph";
import { TraditionTabs } from "./TraditionTabs.client";
import { SectionIntro, Spark, revealDelay } from "./ui";

function IncludesList({ items, note }: { items: readonly string[]; note: string }) {
  return (
    <>
      <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink-800">
            <Spark className="mt-1.5 h-3 w-3 shrink-0 text-gold-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-3xl border-l-2 border-gold-400 pl-4 text-sm text-muted">{note}</p>
    </>
  );
}

/** "What exactly will I learn?": the report's sections, then what each tradition adds. */
export function LearnSection() {
  const c = HOME.learn;
  return (
    <section id="learn" aria-labelledby="learn-heading" className="section border-b border-ivory-300 bg-ivory-50">
      <div className="container-page">
        <SectionIntro id="learn-heading" eyebrow={c.eyebrow} lines={[c.headline]} supporting={c.supporting} />
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ivory-300 bg-ivory-300 sm:grid-cols-2 lg:grid-cols-3">
          {c.topics.map((t, i) => (
            <li key={t.title} className="group flex gap-4 bg-ivory-50 p-5 transition-colors duration-300 hover:bg-white sm:block sm:p-7" data-reveal style={revealDelay((i % 3) * 70)}>
              <Glyph name={t.glyph as GlyphName} className="h-7 w-7 shrink-0 text-gold-600 transition-transform duration-500 group-hover:rotate-[8deg]" />
              <div>
                <h3 className="text-[0.95rem] font-semibold text-ink-900 sm:mt-5 sm:text-[0.78rem] sm:uppercase sm:tracking-[0.18em]">{t.title}</h3>
                <p className="mt-1.5 text-[0.93rem] leading-relaxed text-muted sm:mt-2.5 sm:text-[0.95rem]">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-14" data-reveal>
          <TraditionTabs
            labels={[c.tabs.indian, c.tabs.western]}
            panels={[<IncludesList key="indian" items={COPY.indian.includes} note={COPY.indian.timeNote} />, <IncludesList key="western" items={COPY.western.includes} note={COPY.western.timeNote} />]}
          />
        </div>
      </div>
    </section>
  );
}
