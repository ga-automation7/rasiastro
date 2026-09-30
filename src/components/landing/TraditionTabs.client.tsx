"use client";

import { useId, useRef, useState } from "react";

/**
 * Two tabs (Indian / Western) over server-rendered panels. The panels are passed in
 * already rendered, and only hidden once JavaScript runs (html.js), so without
 * JavaScript both lists are simply shown one after the other.
 */
export function TraditionTabs({ labels, panels }: { labels: readonly [string, string]; panels: readonly [React.ReactNode, React.ReactNode] }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (i: number) => {
    setActive(i);
    tabs.current[i]?.focus();
  };
  return (
    <div className="tradition-tabs">
      <div role="tablist" aria-label="Tradition" className="inline-flex rounded-full border border-ivory-300 bg-ivory-100 p-1">
        {labels.map((label, i) => (
          <button
            key={label}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                select(i === 0 ? 1 : 0);
              }
            }}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors duration-200 sm:px-5 ${active === i ? "bg-ink-900 text-ivory-50 shadow-sm" : "text-ink-700 hover:text-ink-950"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} data-panel="" data-selected={active === i ? "" : undefined} className="mt-6">
          {panel}
        </div>
      ))}
    </div>
  );
}
