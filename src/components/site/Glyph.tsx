/**
 * The Rasi Astro line icons: one 24 px grid, one stroke weight, round joins. Drawn from
 * chart geometry (squares of the Rasi chart, orbits, the horizon of the Lagna) so every
 * icon on the site belongs to the same family. Decorative by default (aria-hidden);
 * the text beside an icon always carries the meaning.
 */
const PATHS = {
  chart: <path d="M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16" />,
  nakshatra: (
    <>
      <path d="M16.5 5A7.5 7.5 0 1 0 19 15.5 6 6 0 0 1 16.5 5Z" />
      <path d="M18.6 4.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" />
    </>
  ),
  lagna: (
    <>
      <path d="M3 16h18" />
      <path d="M6.5 16a5.5 5.5 0 0 1 11 0" />
      <path d="M12 5v3M6.3 7.3l2 2M17.7 7.3l-2 2" />
    </>
  ),
  patterns: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4.5l2.2 5.3 5.5.4-4.2 3.5 1.3 5.4L12 16.1l-4.8 3 1.3-5.4-4.2-3.5 5.5-.4z" />
    </>
  ),
  career: (
    <>
      <path d="M4 19l6-6 3 3 7-7" />
      <path d="M15 9h5v5" />
    </>
  ),
  relationships: (
    <>
      <circle cx="9" cy="12" r="5.25" />
      <circle cx="15" cy="12" r="5.25" />
    </>
  ),
  growth: (
    <>
      <path d="M12 20v-8" />
      <path d="M12 12c0-4 2.8-6.5 7-6.5 0 4-2.8 6.5-7 6.5Z" />
      <path d="M12 14.5c0-3.2-2.2-5.2-5.6-5.2 0 3.2 2.2 5.2 5.6 5.2Z" />
    </>
  ),
  past: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.2h3.2" />
      <path d="M12 8v4l2.8 1.7" />
    </>
  ),
  periods: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  perspectives: (
    <>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
    </>
  ),
  summary: (
    <>
      <path d="M6.5 3.5h8l3 3v14h-11z" />
      <path d="M9 10.5h6M9 14h6M9 17.5h3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z" />
      <path d="M9 12l2.2 2.2L15.2 10" />
    </>
  ),
  spark: <path d="M12 3.5l1.7 6.8 6.8 1.7-6.8 1.7-1.7 6.8-1.7-6.8-6.8-1.7 6.8-1.7z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  document: (
    <>
      <path d="M6.5 3.5h8l3 3v14h-11z" />
      <path d="M14.5 3.5v3h3" />
      <path d="M12 10v6M9.5 13.5 12 16l2.5-2.5" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8Z" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="8" strokeDasharray="1.5 2.5" />
      <circle cx="19.2" cy="8.6" r="1.2" />
    </>
  ),
} as const;

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, className = "h-6 w-6", strokeWidth = 1.3, title }: { name: GlyphName; className?: string; strokeWidth?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {PATHS[name]}
    </svg>
  );
}
