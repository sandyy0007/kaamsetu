import { useId } from "react";
import { formatCompact, formatINR } from "@/lib/utils";

/** Dependency-free SVG charts. All colours are theme tokens; every chart has a text alternative. */

export const CHART_COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;
const col = (i: number, a = 1) => `hsl(var(--${CHART_COLORS[i % CHART_COLORS.length]}) / ${a})`;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function Legend({ items }: { items: { label: string; color: number }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col(i.color) }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Grouped vertical bars. `series` colours map to chart-1..5. Negative values are clamped for display but listed in the table. */
export function BarChart({ data, series, title, money = true, height = 180 }: { data: { label: string; values: number[] }[]; series: string[]; title: string; money?: boolean; height?: number }) {
  const id = useId();
  const W = 340;
  const padL = 38;
  const padB = 22;
  const H = height;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => d.values)));
  const gw = (W - padL) / Math.max(1, data.length);
  const bw = Math.min(26, (gw - 10) / series.length);
  const y = (v: number) => H - padB - (Math.max(0, v) / max) * (H - padB - 8);
  const fmt = (v: number) => (money ? `₹${formatCompact(v)}` : formatCompact(v));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(max * t)} y2={y(max * t)} style={{ stroke: "hsl(var(--border))" }} strokeDasharray={t ? "3 4" : undefined} />
            <text x={padL - 6} y={y(max * t) + 3} textAnchor="end" fontSize="9" style={{ fill: "hsl(var(--muted-foreground))" }}>
              {fmt(max * t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = padL + i * gw + (gw - bw * series.length) / 2;
          return (
            <g key={d.label}>
              {d.values.map((v, j) => (
                <rect key={j} x={x0 + j * bw} y={y(v)} width={bw - 2} height={Math.max(0, H - padB - y(v))} rx="3" style={{ fill: col(j) }}>
                  <title>{`${d.label} · ${series[j]}: ${money ? formatINR(v) : v}`}</title>
                </rect>
              ))}
              <text x={padL + i * gw + gw / 2} y={H - 6} textAnchor="middle" fontSize="10" style={{ fill: "hsl(var(--muted-foreground))" }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend items={series.map((s, i) => ({ label: s, color: i }))} />
      <figcaption className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>Period</th>
              {series.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                {d.values.map((v, j) => (
                  <td key={j}>{money ? formatINR(v) : v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Single-series smooth area/line chart (e.g. signups per day). */
export function LineChart({ data, title, height = 140, money = false }: { data: { label: string; value: number }[]; title: string; height?: number; money?: boolean }) {
  const id = useId();
  const W = 340;
  const H = height;
  const padB = 20;
  const padX = 8;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const step = (W - padX * 2) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => [padX + i * step, H - padB - (d.value / max) * (H - padB - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts.at(-1)?.[0] ?? 0} ${H - padB} L${pts[0]?.[0] ?? 0} ${H - padB}Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: col(0, 0.35) }} />
            <stop offset="1" style={{ stopColor: col(0, 0) }} />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} style={{ stroke: "hsl(var(--border))" }} />
        <path d={area} fill={`url(#${id}-g)`} />
        <path d={line} fill="none" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: col(0) }} />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" style={{ fill: "hsl(var(--card))", stroke: col(0), strokeWidth: 2 }}>
            <title>{`${data[i]!.label}: ${money ? formatINR(data[i]!.value) : data[i]!.value}`}</title>
          </circle>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 ? (
            <text key={i} x={pts[i]![0]} y={H - 5} textAnchor="middle" fontSize="9" style={{ fill: "hsl(var(--muted-foreground))" }}>
              {d.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="sr-only">{`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}</figcaption>
    </figure>
  );
}

/** Donut with a centre label + legend that doubles as the accessible table. */
export function Donut({ slices, title, centre, money = true }: { slices: { label: string; value: number }[]; title: string; centre?: { top: string; bottom: string }; money?: boolean }) {
  const id = useId();
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <figure className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth="18" style={{ stroke: "hsl(var(--muted))" }} />
        {slices.map((s, i) => {
          const len = (s.value / total) * C;
          const el = <circle key={s.label} cx="70" cy="70" r={R} fill="none" strokeWidth="18" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" style={{ stroke: col(i) }} />;
          acc += len;
          return el;
        })}
        {centre && (
          <>
            <text x="70" y="68" textAnchor="middle" fontSize="15" fontWeight="700" style={{ fill: "hsl(var(--foreground))" }}>
              {centre.top}
            </text>
            <text x="70" y="84" textAnchor="middle" fontSize="9" style={{ fill: "hsl(var(--muted-foreground))" }}>
              {centre.bottom}
            </text>
          </>
        )}
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col(i) }} aria-hidden />
              {s.label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {money ? formatINR(s.value) : s.value} · {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Horizontal bars for rankings. */
export function HBars({ rows, money = false }: { rows: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{money ? formatINR(r.value) : r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: col(i) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Circular score meter (used for the Farm Health Score — record completeness, not crop condition). */
export function ScoreRing({ score, max = 100, label, size = 112 }: { score: number; max?: number; label: string; size?: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, score / max));
  const tone = pct >= 0.8 ? "success" : pct >= 0.5 ? "warning" : "danger";
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" role="img" aria-label={`${label}: ${score} out of ${max}`}>
      <circle cx="55" cy="55" r={R} fill="none" strokeWidth="10" style={{ stroke: "hsl(var(--muted))" }} />
      <circle cx="55" cy="55" r={R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 55 55)" style={{ stroke: `hsl(var(--${tone}))`, transition: "stroke-dasharray .6s ease" }} />
      <text x="55" y="58" textAnchor="middle" fontSize="26" fontWeight="800" style={{ fill: "hsl(var(--foreground))" }}>
        {score}
      </text>
      <text x="55" y="74" textAnchor="middle" fontSize="9" style={{ fill: "hsl(var(--muted-foreground))" }}>
        of {max}
      </text>
    </svg>
  );
}
