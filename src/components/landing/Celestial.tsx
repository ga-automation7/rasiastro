/**
 * Celestial artwork drawn in code (inline SVG, a few kilobytes, nothing to download):
 * a quiet star field and an astrolabe with the twelve rasi divisions and a South
 * Indian chart grid at its heart. Decorative only, hidden from assistive technology.
 * Positions come from a fixed seed, so server and browser draw the same sky.
 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function StarField({ count = 110, seed = 7, className = "" }: { count?: number; seed?: number; className?: string }) {
  const rand = seeded(seed);
  const stars = Array.from({ length: count }, (_, i) => {
    const x = rand() * 1000;
    const y = rand() * 1000;
    const r = rand() < 0.9 ? 0.5 + rand() * 0.7 : 1.2 + rand() * 0.8;
    const o = 0.25 + rand() * 0.55;
    return { i, x, y, r, o, glint: i % 17 === 0 };
  });
  return (
    <svg aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className={className}>
      {stars.map((s) => (
        <circle
          key={s.i}
          cx={s.x.toFixed(1)}
          cy={s.y.toFixed(1)}
          r={s.r.toFixed(2)}
          fill="#f7ecd2"
          opacity={s.o.toFixed(2)}
          className={s.glint ? "star-glint" : undefined}
          style={s.glint ? ({ "--glint-delay": `${(s.i % 5) * 1.3}s` } as React.CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}

const RASI = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];

/** Twelve 30° divisions, fine degree ticks, orbits, a chart grid and a few constellation lines. */
export function Astrolabe({ className = "" }: { className?: string }) {
  const c = 300;
  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  };
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const gold = "var(--color-gold-300)";
  return (
    <svg aria-hidden="true" viewBox="0 0 600 600" className={className} fill="none">
      <defs>
        <radialGradient id="astro-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e3c486" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#e3c486" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#e3c486" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r="290" fill="url(#astro-glow)" />

      {/* Outer ring with degree ticks and the twelve rasi names: turns once in seven minutes. */}
      <g className="orbit-slow">
        <circle cx={c} cy={c} r="268" stroke={gold} strokeOpacity="0.35" strokeWidth="0.8" />
        <circle cx={c} cy={c} r="248" stroke={gold} strokeOpacity="0.22" strokeWidth="0.6" />
        {ticks.map((d) => {
          const long = d % 30 === 0;
          const [x1, y1] = polar(d, 268);
          const [x2, y2] = polar(d, long ? 236 : 260);
          return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold} strokeOpacity={long ? 0.45 : 0.22} strokeWidth={long ? 0.8 : 0.5} />;
        })}
        {RASI.map((name, i) => {
          const [x, y] = polar(i * 30 + 15, 256);
          return (
            <text key={name} x={x} y={y} fill={gold} fillOpacity="0.5" fontSize="8.5" letterSpacing="1.2" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * 30 + 15} ${x} ${y})`}>
              {name.toUpperCase()}
            </text>
          );
        })}
      </g>

      {/* Inner orbits turning the other way, very slowly. */}
      <g className="orbit-slower">
        <circle cx={c} cy={c} r="200" stroke={gold} strokeOpacity="0.18" strokeWidth="0.6" strokeDasharray="2 6" />
        <circle cx={c} cy={c} r="150" stroke={gold} strokeOpacity="0.14" strokeWidth="0.6" />
        <circle cx={polar(40, 200)[0]} cy={polar(40, 200)[1]} r="3.2" fill="#f7ecd2" fillOpacity="0.85" />
        <circle cx={polar(212, 150)[0]} cy={polar(212, 150)[1]} r="2.2" fill="#e3c486" fillOpacity="0.8" />
      </g>

      {/* South Indian chart grid: the frame every Indian report starts from. */}
      <g stroke={gold} strokeOpacity="0.28" strokeWidth="0.7">
        <rect x={c - 92} y={c - 92} width="184" height="184" />
        {/* 4 x 4 frame with the centre 2 x 2 left open, as in the traditional chart. */}
        <line x1={c - 46} y1={c - 92} x2={c - 46} y2={c + 92} />
        <line x1={c + 46} y1={c - 92} x2={c + 46} y2={c + 92} />
        <line x1={c - 92} y1={c - 46} x2={c + 92} y2={c - 46} />
        <line x1={c - 92} y1={c + 46} x2={c + 92} y2={c + 46} />
        <line x1={c} y1={c - 92} x2={c} y2={c - 46} />
        <line x1={c} y1={c + 46} x2={c} y2={c + 92} />
        <line x1={c - 92} y1={c} x2={c - 46} y2={c} />
        <line x1={c + 46} y1={c} x2={c + 92} y2={c} />
      </g>
      <path d={`M${c} ${c - 14} L${c + 3.5} ${c - 3.5} L${c + 14} ${c} L${c + 3.5} ${c + 3.5} L${c} ${c + 14} L${c - 3.5} ${c + 3.5} L${c - 14} ${c} L${c - 3.5} ${c - 3.5} Z`} fill={gold} fillOpacity="0.55" />

      {/* A faint constellation and astronomical coordinates. */}
      <polyline points="92,118 138,96 176,132 214,120 236,160" stroke={gold} strokeOpacity="0.25" strokeWidth="0.6" />
      {[
        [92, 118],
        [138, 96],
        [176, 132],
        [214, 120],
        [236, 160],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#f7ecd2" fillOpacity="0.7" />
      ))}
      <text x="36" y="578" fill={gold} fillOpacity="0.35" fontSize="8" letterSpacing="1.5">
        RA 06H 30M · DEC +16° 30′
      </text>
      <text x="564" y="30" fill={gold} fillOpacity="0.35" fontSize="8" letterSpacing="1.5" textAnchor="end">
        ECLIPTIC · 0° MESHA
      </text>
    </svg>
  );
}
