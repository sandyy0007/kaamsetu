"use client";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Notice, PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, QueryBoundary } from "@/components/ui/state";
import { useGet } from "@/hooks/use-api";
import { RAJASTHAN_DISTRICTS } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { MapPointDTO } from "@/types/dto";
import { ToggleChip } from "./filters";
import { useCatalog } from "./pro-shared";

const TYPES: { id: MapPointDTO["type"]; label: string; fill: string }[] = [
  { id: "PROFESSIONAL", label: "Professionals", fill: "hsl(var(--primary))" },
  { id: "OPPORTUNITY", label: "Work", fill: "hsl(var(--accent))" },
  { id: "SERVICE", label: "Services", fill: "hsl(var(--info))" },
  { id: "BUSINESS", label: "Businesses", fill: "hsl(var(--success))" },
  { id: "EVENT", label: "Events", fill: "hsl(var(--highlight))" },
];

const BOUNDS = { minLat: 23.0, maxLat: 30.3, minLng: 69.4, maxLng: 78.4 };
const W = 640;
const H = 560;
const project = (lat: number, lng: number) => ({
  x: ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W,
  y: H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H,
});

function MapBody({ points }: { points: MapPointDTO[] }) {
  const [active, setActive] = useState<string | null>(null);
  const sel = points.find((p) => p.id === active);
  const color = (t: MapPointDTO["type"]) => TYPES.find((x) => x.id === t)!.fill;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card className="overflow-hidden p-2">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Approximate-area map with ${points.length} items. The same items are listed beside or below the map.`} className="h-auto w-full rounded-xl bg-muted/40">
          {/* graticule only — a schematic, not a survey map */}
          {[24, 26, 28, 30].map((lat) => {
            const y = project(lat, 0).y;
            return <line key={lat} x1={0} x2={W} y1={y} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 6" />;
          })}
          {[70, 72, 74, 76, 78].map((lng) => {
            const x = project(0, lng).x;
            return <line key={lng} y1={0} y2={H} x1={x} x2={x} stroke="hsl(var(--border))" strokeDasharray="4 6" />;
          })}
          {Object.entries(RAJASTHAN_DISTRICTS).map(([name, g]) => {
            const { x, y } = project(g.lat, g.lng);
            return (
              <g key={name} aria-hidden>
                <circle cx={x} cy={y} r={2.5} fill="hsl(var(--muted-foreground))" opacity={0.6} />
                <text x={x + 5} y={y - 4} fontSize={10} fill="hsl(var(--muted-foreground))">
                  {name}
                </text>
              </g>
            );
          })}
          {points.map((p) => {
            const { x, y } = project(p.lat, p.lng);
            const on = p.id === active;
            return (
              <g key={p.id} transform={`translate(${x} ${y})`} onClick={() => setActive(on ? null : p.id)} className="cursor-pointer">
                <circle r={on ? 13 : 9} fill={color(p.type)} opacity={0.22} />
                <circle r={on ? 8 : 6} fill={color(p.type)} stroke="hsl(var(--card))" strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">Dots are placed near the district — not at anyone&apos;s real address.</p>
      </Card>
      <div className="space-y-3">
        {sel && (
          <Card className="border-primary p-3.5">
            <p className="text-lg">{sel.emoji}</p>
            <Link href={sel.href} className="font-bold text-primary hover:underline">
              {sel.title}
            </Link>
            <p className="text-sm text-muted-foreground">{sel.subtitle}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {sel.area}
            </p>
          </Card>
        )}
        <Card className="max-h-[28rem] overflow-y-auto p-2">
          <ul>
            {points.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setActive(p.id)} aria-pressed={p.id === active} className={cn("flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-muted", p.id === active && "bg-primary/8")}>
                  <span aria-hidden className="text-lg">
                    {p.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.subtitle} · {p.area}
                    </span>
                  </span>
                  <Badge tone="outline" className="ml-auto shrink-0">
                    {TYPES.find((t) => t.id === p.type)?.label}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function WorkMapView() {
  const { data: catalog } = useCatalog();
  const [types, setTypes] = useState<MapPointDTO["type"][]>(["PROFESSIONAL", "OPPORTUNITY", "BUSINESS", "SERVICE"]);
  const [profession, setProfession] = useState("");
  const path = useMemo(() => {
    const qs = new URLSearchParams({ types: types.join(",") });
    if (profession) qs.set("profession", profession);
    return `/map/points?${qs}`;
  }, [types, profession]);
  const q = useGet<MapPointDTO[]>(types.length ? path : null, { keepPrevious: true });
  return (
    <div>
      <PageHeader title="Nearby map" subtitle="Professionals, work, services and businesses around you — shown by approximate area only." />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show on map">
        {TYPES.map((t) => (
          <ToggleChip key={t.id} on={types.includes(t.id)} onChange={(on) => setTypes((cur) => (on ? [...cur, t.id] : cur.filter((x) => x !== t.id)))}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.fill }} aria-hidden /> {t.label}
          </ToggleChip>
        ))}
        <Select aria-label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} className="w-56">
          <option value="">Any profession</option>
          {catalog?.categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.professions
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </div>
      <div className="mb-4">
        <Notice tone="info">This is a simple schematic map. Real street maps are not connected yet, so positions are district-level and slightly shifted for privacy.</Notice>
      </div>
      {types.length === 0 ? (
        <Card>
          <EmptyState title="Choose what to show" description="Turn on at least one type above." />
        </Card>
      ) : (
        <QueryBoundary query={q} skeleton={<ListSkeleton count={2} />}>
          {(pts) => (pts.length === 0 ? <Card><EmptyState title="Nothing to show here yet" description="Try other types or remove the profession filter." /></Card> : <MapBody points={pts} />)}
        </QueryBoundary>
      )}
    </div>
  );
}
