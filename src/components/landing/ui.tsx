/**
 * Small shared pieces for the marketing pages. Motion comes from [data-reveal]
 * (globals.css): content is only hidden once JavaScript has started, and reduced
 * motion shows it at once.
 */
export const revealDelay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

export function MaskHeading({ id, lines, className, as: Tag = "h2", accent = "" }: { id?: string; lines: readonly string[]; className: string; as?: "h1" | "h2" | "h3"; accent?: string }) {
  return (
    <Tag id={id} className={className} data-reveal="mask">
      {lines.map((line, i) => (
        <span key={line} className="mask-line" style={{ "--line": i } as React.CSSProperties}>
          <span className={i ? accent : undefined}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}

export function Spark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <path fill="currentColor" d="M8 0 9.4 6.6 16 8 9.4 9.4 8 16 6.6 9.4 0 8 6.6 6.6Z" />
    </svg>
  );
}

/** A quiet celestial divider: a hairline with a small star at its centre. */
export function StarRule({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-3 text-gold-500 ${className}`}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-400/60" />
      <Spark className="h-2.5 w-2.5" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-400/60" />
    </div>
  );
}

/** Eyebrow, heading and supporting line, used at the top of most sections. */
export function SectionIntro({
  id,
  eyebrow,
  lines,
  supporting,
  center = false,
  tone = "light",
  accent,
}: {
  id: string;
  eyebrow: string;
  lines: readonly string[];
  supporting?: string;
  center?: boolean;
  tone?: "light" | "dark";
  accent?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className={`eyebrow ${dark ? "!text-gold-300" : ""}`} data-reveal>
        {eyebrow}
      </p>
      <MaskHeading id={id} lines={lines} className={`h-section mt-4 ${dark ? "text-ivory-50" : "text-ink-950"}`} accent={accent ?? (dark ? "text-gold-300" : "text-ink-700")} />
      {supporting ? (
        <p className={`lede mt-5 ${center ? "mx-auto" : ""} max-w-xl ${dark ? "!text-ivory-200/90" : ""}`} data-reveal style={revealDelay(120)}>
          {supporting}
        </p>
      ) : null}
    </div>
  );
}
