"use client";

import { useEffect, useRef, useState } from "react";

export interface SamplePage {
  key: string;
  label: string;
  node: React.ReactNode;
}

/**
 * Sample report pages on a swipeable rail (snap scrolling; arrows on larger screens).
 * Each page opens larger in a native <dialog>, which brings focus trapping, Escape to
 * close and focus return with it. Without JavaScript the rail still scrolls.
 */
export function SampleRail({ pages }: { pages: SamplePage[] }) {
  const rail = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollByPage = (dir: 1 | -1) => {
    const el = rail.current;
    const first = el?.querySelector("li");
    if (!el || !first) return;
    el.scrollBy({ left: dir * (first.getBoundingClientRect().width + 20), behavior: "smooth" });
  };

  const show = (i: number) => {
    setOpen(i);
    if (!dialog.current?.open) dialog.current?.showModal();
  };
  const current = open === null ? null : pages[open];

  return (
    <div className="relative">
      <ul
        ref={rail}
        className="-mx-(--gutter) flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-(--gutter) px-(--gutter) pb-8 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Sample report pages"
      >
        {pages.map((page, i) => (
          <li key={page.key} className="w-[76vw] max-w-[19rem] shrink-0 snap-start text-[clamp(12px,3.6vw,14.5px)] sm:w-[17.5rem] lg:w-[18.5rem]">
            <div data-reveal="rise" style={{ "--reveal-delay": `${Math.min(i, 3) * 90}ms` } as React.CSSProperties}>
              <figure className="doc-page group relative transition-transform duration-500 ease-[var(--ease-soft)] hover:-translate-y-1.5">
                {page.node}
                <button type="button" onClick={() => show(i)} className="absolute inset-0 rounded-[inherit]" aria-label={`Open the ${page.label} page larger`}>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink-900/85 text-ivory-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-90"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
                    </svg>
                  </span>
                </button>
              </figure>
              <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                <span className="text-gold-600">{String(i + 1).padStart(2, "0")}</span> · {page.label}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-1 hidden justify-center gap-3 sm:flex">
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => scrollByPage(dir)}
            disabled={dir === -1 ? edges.start : edges.end}
            aria-label={dir === -1 ? "Previous pages" : "Next pages"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-900/20 text-ink-800 transition-all duration-200 hover:border-ink-900/50 hover:bg-white disabled:opacity-30"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 ${dir === -1 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-label={current ? `${current.label}, sample page` : "Sample page"}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="sample-dialog m-auto max-h-[100svh] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-(--color-midnight)/80 backdrop:backdrop-blur-sm"
      >
        {current && open !== null ? (
          <div className="flex w-[min(92vw,30rem)] flex-col items-center gap-4 py-4">
            <div className="flex w-full items-center justify-between text-ivory-100">
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                <span className="text-gold-300">{String(open + 1).padStart(2, "0")}</span> · {current.label}
              </p>
              <button type="button" onClick={() => dialog.current?.close()} className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory-100/30 hover:bg-white/10" aria-label="Close">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <figure className="doc-page w-full text-[clamp(14px,4.4vw,20px)] shadow-2xl">{current.node}</figure>
            <div className="flex gap-3">
              <button type="button" disabled={open === 0} onClick={() => setOpen(open - 1)} className="btn min-h-11 border border-ivory-100/30 px-4 text-sm text-ivory-50 hover:bg-white/10 disabled:opacity-30">
                Previous
              </button>
              <button type="button" disabled={open === pages.length - 1} onClick={() => setOpen(open + 1)} className="btn min-h-11 border border-ivory-100/30 px-4 text-sm text-ivory-50 hover:bg-white/10 disabled:opacity-30">
                Next
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
