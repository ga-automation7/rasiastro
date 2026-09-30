import Link from "next/link";
import { HOME } from "@/content/site-copy";
import { getReportPreview } from "@/server/reports/preview";
import { SampleRail, type SamplePage } from "./SampleRail.client";
import { SectionIntro, revealDelay } from "./ui";

/**
 * Six pages from the public SAMPLE report (a fictional person, a genuinely calculated
 * chart, hand-written illustrative text), drawn as HTML at page proportions: light to
 * load, sharp at any size, and labelled as a sample.
 */
function PageHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e4d4b3] pb-[0.6em] text-[0.62em] font-semibold uppercase tracking-[0.18em] text-[#7a561a]">
      <span>Rasi Astro</span>
      <span>{label}</span>
    </div>
  );
}

function Lines({ n, last = 0.6 }: { n: number; last?: number }) {
  return (
    <div aria-hidden="true" className="mt-[0.9em] space-y-[0.55em]">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-[0.42em] rounded-full bg-[#e9e1cf]" style={{ width: i === n - 1 ? `${last * 100}%` : "100%" }} />
      ))}
    </div>
  );
}

export async function SampleReport({ available }: { available: boolean }) {
  const s = HOME.sample;
  const p = await getReportPreview();
  const pages: SamplePage[] = [
    {
      key: "cover",
      label: "Cover",
      node: (
        <div key="cover" className="flex h-full flex-col justify-between bg-[linear-gradient(160deg,#fffdf8_60%,#f6eedd)] p-[1.6em]">
          <div>
            <p className="text-[0.62em] font-semibold uppercase tracking-[0.2em] text-[#7a561a]">Rasi Astro</p>
            <p className="mt-[2.2em] font-display text-[1.55em] leading-[1.12] text-[#1c2552]">{p.title}</p>
            <p className="mt-[0.7em] text-[0.95em] font-semibold text-[#131b3b]">{p.subject}</p>
            <div className="mt-[1.2em] h-px bg-gradient-to-r from-[#b8893a] to-transparent" />
          </div>
          <div className="text-[0.62em] text-[#5c6079]">
            <p>Order reference {p.reference}</p>
            <p className="mt-[0.3em] uppercase tracking-[0.14em] text-[#7a561a]">Sample report</p>
          </div>
        </div>
      ),
    },
    {
      key: "chart",
      label: "Your Rasi chart",
      node: (
        <div key="chart" className="p-[1.4em]">
          <PageHeader label="Chart" />
          <p className="mt-[0.8em] font-display text-[0.95em] text-[#1c2552]">Your chart at a glance</p>
          <div className="report-web mx-auto mt-[0.6em] w-[86%] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: p.chartSvg }} />
          <dl className="mt-[0.6em] divide-y divide-[#efe6d3] text-[0.62em]">
            {p.glance.map((g) => (
              <div key={g.label} className="flex justify-between gap-2 py-[0.3em]">
                <dt className="font-semibold text-[#1c2552]">{g.label}</dt>
                <dd className="text-right text-[#3b3f58]">{g.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ),
    },
    {
      key: "overview",
      label: "Personality overview",
      node: (
        <div key="overview" className="p-[1.4em]">
          <PageHeader label="Overview" />
          <p className="mt-[1.1em] font-display text-[1.02em] leading-snug text-[#1c2552]">{p.overview.headline}</p>
          <p className="mt-[0.8em] text-[0.7em] leading-[1.65] text-[#3b3f58]">{p.overview.excerpt}</p>
          <p className="mt-[1.1em] font-display text-[0.9em] text-[#1c2552]">Career and work</p>
          <p className="mt-[0.4em] text-[0.66em] leading-[1.6] text-[#3b3f58]">{p.career}</p>
          <Lines n={3} />
        </div>
      ),
    },
    {
      key: "planets",
      label: "Planetary positions",
      node: (
        <div key="planets" className="p-[1.4em]">
          <PageHeader label="Planets" />
          <p className="mt-[1.1em] font-display text-[1.02em] text-[#1c2552]">Planetary positions</p>
          <table className="mt-[0.8em] w-full text-left text-[0.6em] text-[#3b3f58]">
            <thead>
              <tr className="border-b border-[#e4d4b3] text-[#7a561a]">
                <th className="py-[0.45em] font-semibold">Planet</th>
                <th className="py-[0.45em] font-semibold">Sign</th>
                <th className="py-[0.45em] font-semibold">Degree</th>
                <th className="py-[0.45em] text-right font-semibold">House</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efe6d3]">
              {p.planets.map((row) => (
                <tr key={row.name}>
                  <td className="py-[0.42em] font-semibold text-[#1c2552]">{row.name}</td>
                  <td className="py-[0.42em]">{row.sign}</td>
                  <td className="py-[0.42em] tabular-nums">{row.degree}</td>
                  <td className="py-[0.42em] text-right tabular-nums">{row.house}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "ahead",
      label: "Looking ahead",
      node: (
        <div key="ahead" className="p-[1.4em]">
          <PageHeader label="Periods" />
          <p className="mt-[1.1em] font-display text-[1.02em] text-[#1c2552]">Looking ahead</p>
          <div className="mt-[0.8em] rounded-[0.4em] border border-[#e4d4b3] bg-[#f6eedd] p-[0.8em]">
            <p className="text-[0.62em] font-semibold uppercase tracking-[0.14em] text-[#7a561a]">{p.ahead.dates}</p>
            <p className="mt-[0.2em] font-display text-[0.92em] text-[#1c2552]">{p.ahead.title}</p>
            <p className="mt-[0.4em] text-[0.66em] leading-[1.6] text-[#3b3f58]">{p.ahead.excerpt}</p>
          </div>
          <Lines n={4} />
        </div>
      ),
    },
    {
      key: "summary",
      label: "Your summary",
      node: (
        <div key="summary" className="p-[1.4em]">
          <PageHeader label="Summary" />
          <p className="mt-[1.1em] font-display text-[1.02em] text-[#1c2552]">Combined summary</p>
          <p className="mt-[0.8em] text-[0.7em] leading-[1.65] text-[#3b3f58]">{p.summary}</p>
          <Lines n={4} last={0.4} />
          <div className="mt-[1.4em] flex items-center gap-[0.6em] text-[0.6em] uppercase tracking-[0.16em] text-[#7a561a]">
            <span className="h-px flex-1 bg-[#e4d4b3]" />
            End of report
            <span className="h-px flex-1 bg-[#e4d4b3]" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="report" aria-labelledby="sample-heading" className="section scroll-mt-16 overflow-hidden">
      <style>{p.chartCss}</style>
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionIntro id="sample-heading" eyebrow={s.eyebrow} lines={s.headline} supporting={s.supporting} />
          {available ? (
            <div data-reveal style={revealDelay(200)}>
              <Link href="/start" className="btn btn-primary hidden px-7 lg:inline-flex">
                {s.cta}
              </Link>
            </div>
          ) : null}
        </div>
        <div className="mt-12">
          <SampleRail pages={pages} />
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 text-center" data-reveal>
          {available ? (
            <Link href="/start" className="btn btn-primary px-7 lg:hidden">
              {s.cta}
            </Link>
          ) : null}
          <p className="max-w-lg text-xs text-muted">{s.sampleNote}</p>
        </div>
      </div>
    </section>
  );
}
