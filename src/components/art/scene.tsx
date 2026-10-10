import { useId, type CSSProperties, type ReactNode } from "react";
import type { SceneKind } from "@/types/domain";
import { cn } from "@/lib/utils";

/**
 * Procedural, theme-aware farm artwork (no photos, no copyrighted imagery).
 * Sky / hills / field colours come from CSS tokens, so every scene re-skins with the theme.
 */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const hash = (str: string) => [...str].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const tok = (name: string, a?: number): CSSProperties => ({ fill: `hsl(var(--${name})${a !== undefined ? ` / ${a}` : ""})` });
const fx = (c: string): CSSProperties => ({ fill: c });
const stroke = (c: string, w = 1): CSSProperties => ({ stroke: c, strokeWidth: w, fill: "none", strokeLinecap: "round" });

const FIELD_TOP = 168;

/** Items sorted by depth (y) so nearer plants paint over farther ones. */
function field(n: number, seed: number, draw: (x: number, y: number, k: number, i: number, r: () => number) => ReactNode, top = FIELD_TOP + 6, bottom = 240) {
  const r = rng(seed);
  const pts = Array.from({ length: n }, () => ({ x: r() * 420 - 10, y: top + r() * (bottom - top) })).sort((a, b) => a.y - b.y);
  return pts.map((p, i) => {
    const k = 0.45 + ((p.y - top) / (bottom - top)) * 0.95;
    return <g key={i}>{draw(p.x, p.y, k, i, r)}</g>;
  });
}

function Base({ id, kind, children, dim }: { id: string; kind: SceneKind; children?: ReactNode; dim?: boolean }) {
  const r = rng(hash(kind));
  const rows = Array.from({ length: 13 }, (_, i) => -340 + i * 90 + r() * 8);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "hsl(var(--sky-1))" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--sky-2))" }} />
        </linearGradient>
        <linearGradient id={`${id}-fld`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "hsl(var(--field-2))" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--field-1))" }} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" style={{ stopColor: "hsl(var(--sun) / 0.55)" }} />
          <stop offset="1" style={{ stopColor: "hsl(var(--sun) / 0)" }} />
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}-sky)`} />
      <circle cx="312" cy="62" r="54" fill={`url(#${id}-sun)`} />
      <circle cx="312" cy="62" r="20" style={tok("sun")} />
      <path d="M0 150 Q70 112 150 138 T300 128 T400 142 V240 H0Z" style={tok("hill-1")} />
      <path d="M0 170 Q110 128 220 160 T400 154 V240 H0Z" style={tok("hill-2")} />
      <rect y={FIELD_TOP} width="400" height="72" fill={`url(#${id}-fld)`} />
      {!dim && rows.map((x, i) => <line key={i} x1="200" y1={FIELD_TOP} x2={x} y2="244" style={{ stroke: "hsl(var(--foreground) / 0.12)", strokeWidth: 1.2 }} />)}
      {children}
    </>
  );
}

const GOLD = "hsl(43 82% 52%)";
const GREEN = "hsl(110 45% 34%)";
const GREEN_L = "hsl(100 48% 46%)";
const YELLOW = "hsl(49 96% 54%)";

function wheat() {
  return field(70, 11, (x, y, k, _i, r) => {
    const h = 26 * k;
    const lean = (r() - 0.5) * 5 * k;
    return (
      <>
        <path d={`M${x} ${y} Q${x + lean} ${y - h / 2} ${x + lean * 1.4} ${y - h}`} style={stroke(GREEN_L, 1.1 * k)} />
        <ellipse cx={x + lean * 1.4} cy={y - h - 4 * k} rx={2.1 * k} ry={6 * k} style={fx(GOLD)} />
        <path d={`M${x + lean * 1.4} ${y - h - 9 * k} l0 -3`} style={stroke(GOLD, 0.8 * k)} />
      </>
    );
  });
}

function mustard() {
  return (
    <>
      <rect y={FIELD_TOP} width="400" height="72" style={{ fill: "hsl(48 96% 52% / 0.5)" }} />
      <path d="M0 160 Q110 138 220 156 T400 150 V172 H0Z" style={{ fill: "hsl(48 96% 54% / 0.55)" }} />
      {field(80, 21, (x, y, k, _i, r) => {
        const h = 22 * k;
        return (
          <>
            <path d={`M${x} ${y} L${x + (r() - 0.5) * 3} ${y - h}`} style={stroke(GREEN, 1.1 * k)} />
            {[0, 1, 2].map((j) => (
              <circle key={j} cx={x + (j - 1) * 3.2 * k} cy={y - h - (j % 2) * 3 * k} r={2.6 * k} style={fx(YELLOW)} />
            ))}
          </>
        );
      })}
    </>
  );
}

function bajra() {
  return field(46, 31, (x, y, k, _i, r) => {
    const h = 48 * k;
    const lean = (r() - 0.5) * 6 * k;
    return (
      <>
        <path d={`M${x} ${y} Q${x + lean} ${y - h * 0.5} ${x + lean * 1.5} ${y - h}`} style={stroke("hsl(95 36% 36%)", 1.5 * k)} />
        <path d={`M${x + lean * 0.6} ${y - h * 0.4} q${10 * k} ${-6 * k} ${14 * k} ${-1 * k}`} style={stroke("hsl(95 40% 42%)", 1 * k)} />
        <rect x={x + lean * 1.5 - 3 * k} y={y - h - 14 * k} width={6 * k} height={15 * k} rx={3 * k} style={fx("hsl(32 42% 36%)")} />
      </>
    );
  });
}

function chickpea() {
  return field(54, 41, (x, y, k, _i, r) => (
    <>
      <ellipse cx={x} cy={y - 5 * k} rx={9 * k} ry={6.5 * k} style={fx("hsl(105 38% 40%)")} />
      <ellipse cx={x - 2 * k} cy={y - 7 * k} rx={5 * k} ry={3.5 * k} style={fx("hsl(100 42% 52%)")} />
      {r() > 0.4 && <circle cx={x + 4 * k} cy={y - 4 * k} r={1.4 * k} style={fx("hsl(38 55% 62%)")} />}
    </>
  ));
}

function vegetables() {
  return field(48, 51, (x, y, k, i) => {
    const veg = [["hsl(4 70% 48%)", 3.2], [GOLD, 3.6], ["hsl(24 85% 52%)", 3.4], ["hsl(135 40% 38%)", 3]][i % 4]!;
    return (
      <>
        <ellipse cx={x} cy={y - 4 * k} rx={8 * k} ry={5.5 * k} style={fx("hsl(120 40% 33%)")} />
        <circle cx={x - 3 * k} cy={y - 6 * k} r={(veg[1] as number) * k} style={fx(veg[0] as string)} />
        <circle cx={x + 3.5 * k} cy={y - 4 * k} r={(veg[1] as number) * 0.85 * k} style={fx(veg[0] as string)} />
      </>
    );
  });
}

function dairy() {
  return (
    <>
      <g style={{ filter: "brightness(var(--scene-fixed))" }}>
        <rect x="26" y="108" width="82" height="62" rx="3" style={fx("hsl(8 52% 40%)")} />
        <path d="M18 112 L67 74 L116 112Z" style={fx("hsl(8 40% 30%)")} />
        <rect x="52" y="132" width="30" height="38" rx="2" style={fx("hsl(30 30% 82%)")} />
        <path d="M52 132 L82 170 M82 132 L52 170" style={stroke("hsl(8 40% 30%)", 1.6)} />
        <g transform="translate(176 150)">
          <ellipse cx="46" cy="30" rx="44" ry="22" style={fx("hsl(40 30% 94%)")} />
          <ellipse cx="30" cy="26" rx="14" ry="9" style={fx("hsl(25 18% 22%)")} />
          <ellipse cx="62" cy="36" rx="11" ry="7" style={fx("hsl(25 18% 22%)")} />
          {[18, 34, 62, 78].map((x) => (
            <rect key={x} x={x} y="44" width="7" height="30" rx="2" style={fx("hsl(40 22% 80%)")} />
          ))}
          <ellipse cx="96" cy="10" rx="14" ry="12" style={fx("hsl(40 30% 94%)")} />
          <ellipse cx="102" cy="16" rx="7" ry="5" style={fx("hsl(8 40% 70%)")} />
          <circle cx="94" cy="7" r="1.8" style={fx("hsl(25 18% 15%)")} />
          <path d="M88 -1 l-5 -8 M100 -1 l4 -8" style={stroke("hsl(40 20% 60%)", 2.4)} />
          <path d="M2 24 q-10 6 -8 22" style={stroke("hsl(25 18% 22%)", 2.4)} />
        </g>
      </g>
    </>
  );
}

function orchard() {
  const r = rng(61);
  const trees = [60, 150, 240, 330].map((x, i) => ({ x, y: 168 + (i % 2) * 18, s: 1 + (i % 2) * 0.18 }));
  return (
    <g>
      {trees.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
          <rect x="-4" y="-38" width="8" height="40" rx="2" style={fx("hsl(25 40% 26%)")} />
          <circle cx="0" cy="-58" r="26" style={fx("hsl(115 42% 30%)")} />
          <circle cx="-16" cy="-46" r="17" style={fx("hsl(112 44% 34%)")} />
          <circle cx="16" cy="-48" r="18" style={fx("hsl(118 40% 33%)")} />
          {Array.from({ length: 7 }, (_, j) => (
            <circle key={j} cx={(r() - 0.5) * 48} cy={-58 + (r() - 0.4) * 38} r="3.1" style={fx(i % 2 ? "hsl(24 90% 54%)" : "hsl(4 76% 52%)")} />
          ))}
        </g>
      ))}
    </g>
  );
}

function irrigation() {
  const r = rng(71);
  return (
    <>
      <path d="M-10 196 Q120 178 230 192 T410 186 L410 212 Q290 218 190 208 T-10 222Z" style={{ fill: "hsl(200 70% 46% / 0.9)" }} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M${i * 36 + r() * 12} ${200 + r() * 12} q8 -4 16 0`} style={stroke("hsl(200 80% 82% / 0.75)", 1.4)} />
      ))}
      {field(26, 72, (x, y, k) => (
        <ellipse cx={x} cy={y - 4 * k} rx={7 * k} ry={4.5 * k} style={fx("hsl(120 40% 33%)")} />
      ), 222, 240)}
      <g style={stroke("hsl(200 85% 70%)", 1.6)}>
        {[70, 150, 250, 330].map((x) => (
          <g key={x}>
            <path d={`M${x} 168 L${x} 150`} style={stroke("hsl(0 0% 70%)", 2.4)} />
            <path d={`M${x} 150 q-18 -14 -34 6 M${x} 150 q18 -14 34 6 M${x} 150 q0 -22 0 -28`} />
          </g>
        ))}
      </g>
    </>
  );
}

function tractor() {
  return (
    <>
      {[176, 192, 208, 224].map((y, i) => (
        <path key={i} d={`M0 ${y} Q200 ${y - 10 + i * 2} 400 ${y}`} style={{ stroke: "hsl(var(--foreground) / 0.18)", strokeWidth: 2.2, fill: "none" }} />
      ))}
      <g transform="translate(118 112)" style={{ filter: "brightness(var(--scene-fixed))" }}>
        <rect x="70" y="8" width="62" height="42" rx="6" style={fx("hsl(8 66% 42%)")} />
        <rect x="-6" y="24" width="86" height="34" rx="6" style={fx("hsl(8 70% 46%)")} />
        <rect x="78" y="14" width="44" height="26" rx="3" style={fx("hsl(200 50% 82%)")} />
        <rect x="124" y="-8" width="5" height="26" style={fx("hsl(0 0% 24%)")} />
        <circle cx="106" cy="62" r="30" style={fx("hsl(0 0% 14%)")} />
        <circle cx="106" cy="62" r="14" style={fx("hsl(48 90% 54%)")} />
        <circle cx="22" cy="74" r="18" style={fx("hsl(0 0% 14%)")} />
        <circle cx="22" cy="74" r="8" style={fx("hsl(48 90% 54%)")} />
      </g>
    </>
  );
}

function sunrise() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return <line key={i} x1={200 + Math.cos(a) * 40} y1={128 + Math.sin(a) * 40} x2={200 + Math.cos(a) * 78} y2={128 + Math.sin(a) * 78} style={{ stroke: "hsl(var(--sun) / 0.7)", strokeWidth: 3, strokeLinecap: "round" }} />;
  });
  return (
    <>
      <circle cx="200" cy="128" r="104" style={tok("sun", 0.16)} />
      {rays}
      <circle cx="200" cy="128" r="32" style={tok("sun")} />
      <path d="M0 150 Q70 118 150 142 T300 134 T400 146 V240 H0Z" style={tok("hill-1")} />
      <path d="M0 172 Q110 138 220 166 T400 160 V240 H0Z" style={tok("hill-2")} />
      <rect y="176" width="400" height="64" style={{ fill: "hsl(var(--field-1))" }} />
      {field(30, 81, (x, y, k) => <path d={`M${x} ${y} l0 ${-10 * k}`} style={stroke(GREEN_L, 1.4 * k)} />, 182, 240)}
    </>
  );
}

function market() {
  const stalls = [
    { x: 24, c: "hsl(4 66% 48%)" },
    { x: 150, c: "hsl(43 86% 48%)" },
    { x: 276, c: "hsl(140 44% 34%)" },
  ];
  return (
    <g style={{ filter: "brightness(var(--scene-fixed))" }}>
      <rect y="176" width="400" height="64" style={{ fill: "hsl(32 30% 58% / 0.9)" }} />
      {stalls.map((s, i) => (
        <g key={i} transform={`translate(${s.x} 104)`}>
          <rect x="6" y="30" width="6" height="74" style={fx("hsl(25 30% 28%)")} />
          <rect x="94" y="30" width="6" height="74" style={fx("hsl(25 30% 28%)")} />
          <path d="M0 34 L8 6 H98 L106 34Z" style={fx(s.c)} />
          {[0, 1, 2, 3, 4].map((j) => (
            <path key={j} d={`M${6 + j * 20} 34 l${j % 2 ? 6 : 2} -28 h14 l${j % 2 ? 2 : 6} 28z`} style={fx("hsl(40 40% 96% / 0.9)")} opacity={j % 2 ? 0.9 : 0} />
          ))}
          <rect x="10" y="66" width="86" height="36" rx="3" style={fx("hsl(28 42% 34%)")} />
          {Array.from({ length: 7 }, (_, j) => (
            <circle key={j} cx={20 + j * 11} cy={64} r={6} style={fx(["hsl(4 70% 50%)", "hsl(30 90% 54%)", "hsl(100 45% 42%)", GOLD][(i + j) % 4]!)} />
          ))}
        </g>
      ))}
    </g>
  );
}

function classroom() {
  return (
    <g style={{ filter: "brightness(var(--scene-fixed))" }}>
      <rect y="150" width="400" height="90" style={fx("hsl(32 28% 52%)")} />
      <rect x="70" y="38" width="260" height="112" rx="6" style={fx("hsl(28 34% 30%)")} />
      <rect x="78" y="46" width="244" height="96" rx="3" style={fx("hsl(160 30% 20%)")} />
      <path d="M200 118 V86 M200 98 q-22 -4 -26 -24 q22 -2 26 24 M200 92 q20 -4 24 -22 q-20 -2 -24 22" style={stroke("hsl(0 0% 94%)", 2.6)} />
      <path d="M96 128 h60 M250 128 h54" style={stroke("hsl(0 0% 94% / 0.7)", 2)} />
      {[70, 150, 230, 310].map((x, i) => (
        <g key={x} transform={`translate(${x} 176)`}>
          <circle cx="12" cy="-6" r="7" style={fx(`hsl(${22 + i * 5} 40% ${42 + i * 4}%)`)} />
          <path d="M0 22 q0 -22 12 -22 q12 0 12 22z" style={fx(["hsl(200 50% 42%)", "hsl(340 50% 46%)", "hsl(140 40% 36%)", "hsl(40 70% 50%)"][i]!)} />
          <rect x="-8" y="22" width="40" height="8" rx="2" style={fx("hsl(25 36% 30%)")} />
        </g>
      ))}
    </g>
  );
}

function health() {
  return (
    <>
      <rect y="176" width="400" height="64" style={{ fill: "hsl(var(--field-1))" }} />
      <g transform="translate(200 112)" style={{ filter: "brightness(var(--scene-fixed))" }}>
        <path d="M0 -62 C26 -50 48 -46 58 -44 V6 C58 38 30 58 0 70 C-30 58 -58 38 -58 6 V-44 C-48 -46 -26 -50 0 -62Z" style={fx("hsl(160 50% 32%)")} />
        <path d="M0 -50 C22 -40 40 -38 48 -36 V4 C48 32 24 48 0 58 C-24 48 -48 32 -48 4 V-36 C-40 -38 -22 -40 0 -50Z" style={fx("hsl(160 46% 40%)")} />
        <rect x="-8" y="-28" width="16" height="52" rx="3" style={fx("hsl(0 0% 98%)")} />
        <rect x="-26" y="-10" width="52" height="16" rx="3" style={fx("hsl(0 0% 98%)")} />
      </g>
      {field(16, 91, (x, y, k) => <path d={`M${x} ${y} q${4 * k} ${-10 * k} ${10 * k} ${-12 * k} q${-2 * k} ${8 * k} ${-10 * k} ${12 * k}`} style={fx(GREEN_L)} />, 196, 240)}
    </>
  );
}

function organic() {
  return (
    <>
      <path d="M40 190 Q120 156 200 190 T360 188 V240 H40Z" style={{ fill: "hsl(24 36% 24%)" }} />
      <g style={{ filter: "brightness(var(--scene-fixed))" }}>
        <path d="M200 192 V112" style={stroke("hsl(110 46% 30%)", 5)} />
        <path d="M200 140 C150 140 126 112 130 82 C168 80 196 104 200 140Z" style={fx("hsl(112 48% 38%)")} />
        <path d="M200 124 C250 126 276 98 272 66 C232 64 204 88 200 124Z" style={fx("hsl(100 52% 46%)")} />
        <path d="M200 112 C186 96 188 76 200 62 C212 76 214 96 200 112Z" style={fx("hsl(96 56% 54%)")} />
        {[[110, 70], [290, 100], [150, 44], [250, 40]].map(([x, y], i) => (
          <path key={i} d={`M${x} ${(y ?? 0) - 7} l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z`} style={fx("hsl(48 96% 62%)")} />
        ))}
      </g>
      {field(22, 95, (x, y, k) => <ellipse cx={x} cy={y} rx={4 * k} ry={2 * k} style={fx("hsl(24 30% 30%)")} />, 200, 238)}
    </>
  );
}

const fixed: CSSProperties = { filter: "brightness(var(--scene-fixed))" };

function workshop() {
  return (
    <g style={fixed}>
      <rect y="170" width="400" height="70" style={fx("hsl(30 14% 40%)")} />
      <rect x="40" y="46" width="320" height="124" rx="4" style={fx("hsl(36 24% 82%)")} />
      <rect x="150" y="70" width="100" height="100" rx="4" style={fx("hsl(210 14% 38%)")} />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          {[0, 1, 2, 3, 4].map((c) => (
            <rect key={c} x={158 + c * 18} y={78 + r * 22} width="12" height="14" rx="2" style={fx(r === 0 && c % 2 === 0 ? "hsl(48 96% 56%)" : "hsl(210 10% 24%)")} />
          ))}
        </g>
      ))}
      <path d="M60 60 C90 110 120 40 150 96" style={stroke("hsl(10 70% 46%)", 3)} />
      <path d="M340 70 C310 120 280 56 250 104" style={stroke("hsl(210 60% 40%)", 3)} />
      <path d="M62 150 l14 -22 h-8 l8 -20 -22 28 h9z" style={fx("hsl(48 96% 54%)")} />
      <rect x="296" y="120" width="44" height="50" rx="3" style={fx("hsl(0 0% 94%)")} />
      <circle cx="318" cy="140" r="9" style={stroke("hsl(210 14% 30%)", 2)} />
    </g>
  );
}

function carpentry() {
  return (
    <g style={fixed}>
      <rect y="170" width="400" height="70" style={fx("hsl(28 34% 46%)")} />
      <rect x="60" y="136" width="280" height="14" rx="3" style={fx("hsl(26 46% 34%)")} />
      <rect x="76" y="150" width="12" height="52" style={fx("hsl(26 46% 28%)")} />
      <rect x="312" y="150" width="12" height="52" style={fx("hsl(26 46% 28%)")} />
      <rect x="110" y="118" width="150" height="18" rx="2" style={fx("hsl(34 62% 62%)")} />
      <path d="M110 118 l12 -8 h150 l-12 8z" style={fx("hsl(36 66% 70%)")} />
      <g transform="translate(262 78) rotate(-14)">
        <rect x="0" y="0" width="96" height="10" rx="2" style={fx("hsl(210 8% 70%)")} />
        <path d="M0 0 l0 10 h-10 l10 -10z" style={fx("hsl(210 8% 58%)")} />
        {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${6 + i * 6} 10 l3 6 l3 -6z`} style={fx("hsl(210 8% 58%)")} />)}
        <rect x="96" y="-6" width="22" height="22" rx="6" style={fx("hsl(10 50% 34%)")} />
      </g>
      {[[90, 168], [140, 176], [300, 172]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q8 -10 16 0 q-8 6 -16 0z`} style={fx("hsl(36 66% 72%)")} />)}
    </g>
  );
}

function tailoring() {
  return (
    <g style={fixed}>
      <rect y="168" width="400" height="72" style={fx("hsl(340 18% 62%)")} />
      <path d="M96 56 q18 -14 36 0 l22 10 l-10 24 l-16 -6 v66 h-46 v-66 l-16 6 l-10 -24z" style={fx("hsl(340 62% 52%)")} />
      <path d="M96 56 q18 14 36 0" style={stroke("hsl(340 40% 30%)", 2)} />
      <path d="M260 120 h90 v50 h-90z" style={fx("hsl(210 14% 84%)")} />
      <rect x="276" y="96" width="20" height="24" rx="3" style={fx("hsl(210 10% 40%)")} />
      <path d="M296 104 q40 -30 40 10" style={stroke("hsl(210 10% 40%)", 4)} />
      <path d="M338 114 v38" style={stroke("hsl(0 0% 20%)", 1.4)} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={16 + i * 24} y={188} width="14" height="26" rx="3" style={fx(["hsl(340 64% 50%)", "hsl(200 60% 44%)", "hsl(48 90% 54%)", "hsl(150 44% 40%)", "hsl(280 44% 48%)", "hsl(20 80% 52%)"][i]!)} />)}
      <path d="M180 150 q14 -12 30 0 q14 12 30 0" style={stroke("hsl(48 92% 54%)", 3)} />
    </g>
  );
}

function pottery() {
  return (
    <g style={fixed}>
      <rect y="176" width="400" height="64" style={fx("hsl(24 40% 40%)")} />
      <ellipse cx="200" cy="184" rx="94" ry="12" style={fx("hsl(22 30% 30%)")} />
      <path d="M150 180 C132 140 144 98 176 84 H224 C256 98 268 140 250 180Z" style={fx("hsl(18 58% 48%)")} />
      <path d="M168 84 h64 l-6 -12 h-52z" style={fx("hsl(18 58% 40%)")} />
      <path d="M150 128 h100 M154 148 h92" style={stroke("hsl(18 40% 32% / 0.7)", 2)} />
      <path d="M60 180 C54 160 60 140 78 134 H98 C112 140 118 160 112 180Z" style={fx("hsl(24 62% 54%)")} />
      <path d="M296 180 C290 164 294 148 308 142 H330 C344 148 350 164 344 180Z" style={fx("hsl(14 54% 44%)")} />
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={78 + i * 56} cy={206} rx={14} ry={6} style={fx("hsl(32 70% 56%)")} />)}
    </g>
  );
}

function road() {
  return (
    <>
      <path d="M0 160 H400 V240 H0Z" style={fx("hsl(210 8% 30%)")} />
      <path d="M-20 240 L200 150 L420 240Z" style={fx("hsl(210 8% 24%)")} />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M200 ${158 + i * 22} l${2 + i * 3} 10 h${-4 - i * 6}z`} style={fx("hsl(48 96% 60%)")} />)}
      <g style={fixed}>
        <rect x="152" y="104" width="96" height="46" rx="6" style={fx("hsl(10 70% 46%)")} />
        <rect x="224" y="86" width="40" height="64" rx="5" style={fx("hsl(200 14% 86%)")} />
        <rect x="230" y="94" width="24" height="18" rx="2" style={fx("hsl(200 60% 70%)")} />
        <circle cx="178" cy="152" r="12" style={fx("hsl(0 0% 14%)")} />
        <circle cx="240" cy="152" r="12" style={fx("hsl(0 0% 14%)")} />
        <circle cx="178" cy="152" r="5" style={fx("hsl(0 0% 70%)")} />
        <circle cx="240" cy="152" r="5" style={fx("hsl(0 0% 70%)")} />
      </g>
    </>
  );
}

function construction() {
  return (
    <g style={fixed}>
      <rect y="176" width="400" height="64" style={fx("hsl(36 30% 54%)")} />
      <rect x="90" y="86" width="190" height="90" style={fx("hsl(20 44% 52%)")} />
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 9 }, (_, c) => <rect key={`${r}${c}`} x={92 + c * 21 + (r % 2 ? 10 : 0)} y={88 + r * 17} width="19" height="15" style={fx(`hsl(${16 + ((r + c) % 3) * 4} 46% ${46 + ((r * c) % 4) * 3}%)`)} />))}
      <rect x="82" y="76" width="206" height="10" style={fx("hsl(210 8% 64%)")} />
      <path d="M310 176 V50 h60 M310 60 l60 0 M340 60 v44" style={stroke("hsl(48 90% 50%)", 4)} />
      <rect x="332" y="104" width="16" height="12" style={fx("hsl(210 8% 40%)")} />
      <path d="M40 176 l20 -34 20 34z" style={fx("hsl(30 60% 46%)")} />
      <rect x="14" y="156" width="26" height="20" style={fx("hsl(210 8% 60%)")} />
    </g>
  );
}

function digital() {
  return (
    <g style={fixed}>
      <rect y="170" width="400" height="70" style={fx("hsl(210 12% 36%)")} />
      <rect x="86" y="54" width="228" height="124" rx="8" style={fx("hsl(210 14% 20%)")} />
      <rect x="94" y="62" width="212" height="108" rx="4" style={fx("hsl(200 70% 46%)")} />
      <rect x="108" y="76" width="84" height="8" rx="2" style={fx("hsl(0 0% 96%)")} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="108" y={94 + i * 14} width={150 - i * 22} height="6" rx="2" style={fx("hsl(0 0% 96% / 0.6)")} />)}
      <circle cx="268" cy="108" r="22" style={fx("hsl(48 96% 58%)")} />
      <path d="M268 94 v16 l12 8" style={stroke("hsl(30 60% 30%)", 3)} />
      <rect x="170" y="178" width="60" height="8" rx="3" style={fx("hsl(210 10% 60%)")} />
      <rect x="40" y="148" width="26" height="46" rx="5" style={fx("hsl(0 0% 14%)")} />
      <rect x="43" y="154" width="20" height="30" rx="2" style={fx("hsl(160 60% 52%)")} />
    </g>
  );
}

const DRAW: Record<SceneKind, () => ReactNode> = { wheat, mustard, bajra, chickpea, vegetables, dairy, orchard, irrigation, tractor, sunrise, market, classroom, health, organic, workshop, carpentry, tailoring, pottery, road, construction, digital };
const SKIP_BASE_FIELD = new Set<SceneKind>(["sunrise", "market", "classroom", "organic", "health", "workshop", "carpentry", "tailoring", "pottery", "construction", "digital", "road"]);

const LABEL: Record<SceneKind, string> = {
  wheat: "Wheat field",
  mustard: "Mustard field in bloom",
  bajra: "Pearl millet (bajra) field",
  chickpea: "Chickpea field",
  vegetables: "Vegetable farm",
  dairy: "Dairy farm with cow and barn",
  orchard: "Orchard",
  irrigation: "Irrigation canal and sprinklers",
  tractor: "Tractor in a field",
  sunrise: "Sunrise over farmland",
  market: "Farmers' market stalls",
  classroom: "Classroom with blackboard",
  health: "Health and safety",
  organic: "Organic sprout",
  workshop: "Electrical workshop with panel and wires",
  carpentry: "Carpenter's bench with saw and wood",
  tailoring: "Tailoring with garment and sewing machine",
  pottery: "Potter's wheel with clay pots",
  road: "Truck on a highway",
  construction: "House under construction",
  digital: "Laptop and phone repair bench",
};

export const SCENE_KINDS = Object.keys(DRAW) as SceneKind[];

export function Scene({ kind, className, decorative = true, title }: { kind: SceneKind; className?: string; decorative?: boolean; title?: string }) {
  const id = useId().replace(/:/g, "");
  const k: SceneKind = DRAW[kind] ? kind : "sunrise";
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cn("block h-full w-full", className)} role={decorative ? "presentation" : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : (title ?? LABEL[k])}>
      <Base id={id} kind={k} dim={SKIP_BASE_FIELD.has(k) || k === "tractor" || k === "irrigation"}>
        {DRAW[k]()}
      </Base>
    </svg>
  );
}
