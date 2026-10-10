"use client";
import { Check, ChevronRight, Droplets, Leaf, Pencil, Plus, Sprout, Tractor, Trash2, Wheat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart, Donut, ScoreRing } from "@/components/art/charts";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Notice, PageHeader, SectionHeader, Stat } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, QueryBoundary } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { roleCan } from "@/lib/capabilities";
import { useMe } from "@/hooks/use-me";
import { EXPENSE_LABEL, STAGE_LABEL } from "@/lib/constants";
import { sceneForCrop } from "@/lib/crop-scene";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { STAGE_KEYS } from "@/types/domain";
import type { CropDetailDTO, CropDTO, CycleDTO, FarmDetailDTO, FarmDTO, FarmHealthScore, FarmSummaryDTO } from "@/types/dto";
import { CropForm, CycleForm, ExpenseForm, FarmForm, HarvestForm } from "./farm-forms";
import { CropRow, FarmCardMini } from "./farmer-profile";

// ───────── health ─────────
export function HealthCard({ h }: { h: FarmHealthScore }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-5">
        <ScoreRing score={h.score} max={h.max} label="Farm Health Score" />
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-lg">Farm Health Score</h2>
          <p className="mt-1 text-sm text-muted-foreground">{h.explanation}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {h.parts.map((p) => (
          <li key={p.key} className={cn("flex items-start gap-2.5 rounded-xl border p-2.5 text-sm", p.done ? "border-success/30 bg-success/8" : "")}>
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", p.done ? "bg-success text-white" : "border-2 border-input")}>{p.done && <Check className="h-3 w-3" />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2 font-semibold">
                {p.label}
                <span className="tabular-nums text-muted-foreground">
                  {p.points}/{p.max}
                </span>
              </span>
              {!p.done && <span className="block text-xs text-muted-foreground">{p.tip}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ───────── /farms ─────────
function FarmerOnly({ what }: { what: string }) {
  return (
    <Card>
      <EmptyState title={`${what} is for farmer accounts`} description="Farm records, crops and costs belong to farmers and stay private to them. Your account type doesn't keep farm records." action={{ label: "Go to Home", href: "/home" }} />
    </Card>
  );
}

export function FarmsView() {
  const me = useMe().data;
  const allowed = !!me && roleCan(me.role, "farm:manage");
  const summary = useGet<FarmSummaryDTO>(allowed ? "/farm/summary" : null);
  const farms = useGet<FarmDTO[]>(allowed ? "/farms" : null);
  const [add, setAdd] = useState(false);
  const router = useRouter();
  if (me && !allowed) return <FarmerOnly what="Farm management" />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="My farm"
        subtitle="Records, costs and profit — private to you."
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/create?type=crop")}>
              <Sprout className="h-4 w-4" /> Add crop
            </Button>
            <Button onClick={() => setAdd(true)}>
              <Plus className="h-4 w-4" /> Add farm
            </Button>
          </>
        }
      />
      <QueryBoundary query={farms} skeleton={<ListSkeleton count={2} />} isEmpty={(f) => f.length === 0} empty={<EmptyState title="Add your first farm" icon={<Tractor className="h-7 w-7" />} description="Start with the basics: farm name, area, soil and irrigation. Then add crops and track costs." action={{ label: "Add a farm", onClick: () => setAdd(true) }} />}>
        {(list) => (
          <>
            <QueryBoundary query={summary} skeleton={<ListSkeleton count={1} />}>
              {(s) => (
                <div className="space-y-4">
                  <Notice tone="info" title="Private by default">
                    Everything on this page — costs, revenue and profit — is visible only to you unless you choose to share a summary in Settings → Privacy.
                  </Notice>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Total cost" value={formatINR(s.totals.cost)} />
                    <Stat label="Revenue (sold)" value={formatINR(s.totals.revenue)} />
                    <Stat label="Net profit" value={formatINR(s.totals.profit)} tone={s.totals.profit >= 0 ? "success" : "danger"} />
                    <Stat label="Farm area" value={`${s.totals.acres} acres`} hint={`${s.farms} farm${s.farms === 1 ? "" : "s"} · ${s.crops} crops`} />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="p-4">
                      <h2 className="mb-2 text-lg">Cost vs revenue by year</h2>
                      {s.byYear.length ? <BarChart title="Cost, revenue and profit by year" series={["Cost", "Revenue", "Profit"]} data={s.byYear.map((y) => ({ label: String(y.year), values: [y.cost, y.revenue, Math.max(0, y.profit)] }))} /> : <EmptyState compact title="No harvests recorded yet" />}
                    </Card>
                    <Card className="p-4">
                      <h2 className="mb-3 text-lg">Where the money goes</h2>
                      {s.byCategory.length ? <Donut title="Expenses by category" slices={s.byCategory.map((c) => ({ label: EXPENSE_LABEL[c.category] ?? c.category, value: c.amount }))} centre={{ top: formatINR(s.totals.cost), bottom: "total cost" }} /> : <EmptyState compact title="No expenses recorded yet" />}
                    </Card>
                  </div>
                  <HealthCard h={s.health} />
                </div>
              )}
            </QueryBoundary>
            <section>
              <SectionHeader title="Your farms" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((f) => (
                  <FarmCardMini key={f.id} f={f} link />
                ))}
              </div>
            </section>
          </>
        )}
      </QueryBoundary>
      <Sheet open={add} onClose={() => setAdd(false)} title="Add a farm" description="You can edit these details later.">
        <FarmForm onDone={(f) => { setAdd(false); router.push(`/farms/${f.id}`); }} />
      </Sheet>
    </div>
  );
}

// ───────── /farms/[id] ─────────
export function FarmDetailView({ id }: { id: string }) {
  const q = useGet<FarmDetailDTO>(`/farms/${id}`);
  const [edit, setEdit] = useState(false);
  const [addCrop, setAddCrop] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const del = async () => {
    try {
      await api("DELETE", `/farms/${id}`);
      await invalidate("/farms", "/farm/summary", "/crops", "/home");
      toast({ title: "Farm deleted" });
      router.replace("/farms");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't delete", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(d) => (
        <div className="space-y-5">
          <Link href="/farms" className="text-sm font-semibold text-primary hover:underline">
            ← My farm
          </Link>
          <Card className="overflow-hidden">
            <div className="h-36 md:h-44">
              <Scene kind={d.farm.scene} />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div>
                <h1 className="flex items-center gap-2">
                  {d.farm.name}
                </h1>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Tractor className="h-4 w-4" aria-hidden />
                    {d.farm.areaAcres} acres
                  </span>
                  <span>{d.farm.soil}</span>
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="h-4 w-4" aria-hidden />
                    {d.farm.irrigation}
                  </span>
                  <span>
                    {d.farm.village}, {d.farm.district}
                  </span>
                </p>
              </div>
              {d.isOwn && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm(true)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </Card>
          {d.health && <HealthCard h={d.health} />}
          <section>
            <SectionHeader title="Crops on this farm">
              {d.isOwn && (
                <Button size="sm" onClick={() => setAddCrop(true)}>
                  <Plus className="h-4 w-4" /> Add crop
                </Button>
              )}
            </SectionHeader>
            {d.farm.crops.length ? (
              <ul className="grid gap-2 md:grid-cols-2">
                {d.farm.crops.map((c) => (
                  <li key={c.id}>
                    <CropRow c={c} link={d.isOwn} />
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <EmptyState compact title="No crops yet" icon={<Sprout className="h-6 w-6" />} action={d.isOwn ? { label: "Add a crop", onClick: () => setAddCrop(true) } : undefined} />
              </Card>
            )}
          </section>
          {d.isOwn && d.cycles.length > 0 && (
            <section>
              <SectionHeader title="Seasons on this farm" />
              <ul className="space-y-2">
                {d.cycles.map((c) => (
                  <li key={c.id}>
                    <Link href={`/crops/${c.cropId}?cycle=${c.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card hover:bg-muted/40">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                        <Scene kind={sceneForCrop(c.cropName)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">
                          {c.cropName} · {c.season} {c.year}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Cost {formatINR(c.stats.totalCost)} · {c.harvest ? `Profit ${formatINR(c.stats.profit)}` : "Not harvested"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Sheet open={edit} onClose={() => setEdit(false)} title="Edit farm">
            <FarmForm initial={d.farm} onDone={() => setEdit(false)} />
          </Sheet>
          <Sheet open={addCrop} onClose={() => setAddCrop(false)} title="Add a crop" size="lg">
            <CropForm defaultFarmId={d.farm.id} onDone={(c) => { setAddCrop(false); router.push(`/crops/${c.id}`); }} />
          </Sheet>
          <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete this farm?" description="This also deletes its crops, seasons, expenses and harvest records. This cannot be undone." size="sm" footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep farm</Button><Button variant="danger" onClick={del}>Delete farm</Button></>}>
            <p className="text-sm">
              You are about to delete <strong>{d.farm.name}</strong>.
            </p>
          </Sheet>
        </div>
      )}
    </QueryBoundary>
  );
}

// ───────── /crops ─────────
export function CropsView() {
  const me = useMe().data;
  const allowed = !!me && roleCan(me.role, "farm:manage");
  const q = useGet<CropDTO[]>(allowed ? "/crops" : null);
  const [add, setAdd] = useState(false);
  const router = useRouter();
  if (me && !allowed) return <FarmerOnly what="Crop tracking" />;
  const groups: { status: CropDTO["status"]; title: string }[] = [
    { status: "GROWING", title: "Growing now" },
    { status: "PLANNED", title: "Planned" },
    { status: "HARVESTED", title: "Harvested" },
    { status: "SOLD", title: "Sold" },
  ];
  return (
    <div>
      <PageHeader title="My crops" subtitle="Every crop you grow, with season-by-season records." actions={<Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" /> Add crop</Button>} />
      <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />} isEmpty={(l) => l.length === 0} empty={<EmptyState title="No crops yet" icon={<Wheat className="h-7 w-7" />} description="Add a crop to record sowing, irrigation, expenses and harvest — and see your profit per acre." action={{ label: "Add a crop", onClick: () => setAdd(true) }} />}>
        {(list) => (
          <div className="space-y-6">
            {groups.map((g) => {
              const rows = list.filter((c) => c.status === g.status);
              if (!rows.length) return null;
              return (
                <section key={g.status}>
                  <h2 className="mb-2 text-lg">
                    {g.title} <span className="text-base font-medium text-muted-foreground">({rows.length})</span>
                  </h2>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {rows.map((c) => (
                      <li key={c.id}>
                        <CropRow c={c} link />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </QueryBoundary>
      <Sheet open={add} onClose={() => setAdd(false)} title="Add a crop" size="lg">
        <CropForm onDone={(c) => { setAdd(false); router.push(`/crops/${c.id}`); }} />
      </Sheet>
    </div>
  );
}

// ───────── cycle manager ─────────
function StageTimeline({ cycle }: { cycle: CycleDTO }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const update = async (stage: string, done: boolean, date?: string) => {
    setBusy(stage);
    try {
      await api("PATCH", `/cycles/${cycle.id}/stages`, { stage, done, date: date || (done ? new Date().toISOString().slice(0, 10) : "") });
      await invalidate("/crops", "/farms", "/home", "/farm/summary");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update stage", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  const doneCount = STAGE_KEYS.filter((k) => cycle.stages[k].done).length;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg">Crop stages</h3>
        <span className="text-sm text-muted-foreground">
          {doneCount} of {STAGE_KEYS.length} done
        </span>
      </div>
      <Progress value={doneCount} max={STAGE_KEYS.length} label="Stages completed" className="mb-4" />
      <ol className="space-y-1">
        {STAGE_KEYS.map((k) => {
          const st = cycle.stages[k];
          return (
            <li key={k} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/50">
              <button onClick={() => update(k, !st.done, st.date)} disabled={busy === k} role="checkbox" aria-checked={st.done} aria-label={`${STAGE_LABEL[k]} ${st.done ? "completed" : "not completed"}`} className={cn("tap grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors", st.done ? "border-success bg-success text-white" : "border-input")}>
                {st.done && <Check className="h-4 w-4" />}
              </button>
              <span className={cn("min-w-0 flex-1 font-semibold", !st.done && "text-muted-foreground")}>{STAGE_LABEL[k]}</span>
              <Input type="date" aria-label={`${STAGE_LABEL[k]} date`} value={st.date?.slice(0, 10) ?? ""} onChange={(e) => update(k, st.done, e.target.value)} className="!min-h-9 w-[9.5rem] !py-1 text-sm" />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function CycleView({ cycle }: { cycle: CycleDTO }) {
  const s = cycle.stats;
  const [addExp, setAddExp] = useState(false);
  const [harvest, setHarvest] = useState(false);
  const invalidate = useInvalidate();
  const toast = useToast();
  const delExpense = async (id: string) => {
    try {
      await api("DELETE", `/expenses/${id}`);
      await invalidate("/crops", "/farms", "/farm/summary");
    } catch {
      toast({ kind: "error", title: "Couldn't delete the expense" });
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total cost" value={formatINR(s.totalCost)} />
        <Stat label="Revenue" value={cycle.harvest ? formatINR(s.revenue) : "—"} hint={cycle.harvest ? `${cycle.harvest.soldQtl} of ${cycle.harvest.quantityQtl} qtl sold` : "Add harvest"} />
        <Stat label="Profit" value={cycle.harvest ? formatINR(s.profit) : "—"} tone={cycle.harvest ? (s.profit >= 0 ? "success" : "danger") : undefined} />
        <Stat label="Profit / acre" value={cycle.harvest ? formatINR(s.profitPerAcre) : "—"} hint={`${cycle.areaAcres} acres`} />
        <Stat label="Cost / quintal" value={s.costPerQtl != null ? formatINR(s.costPerQtl) : "—"} />
        <Stat label="Yield / acre" value={cycle.harvest ? `${s.yieldPerAcre.toFixed(1)} qtl` : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StageTimeline cycle={cycle} />
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg">Harvest & sale</h3>
              <Button size="sm" variant="outline" onClick={() => setHarvest(true)}>
                {cycle.harvest ? "Edit" : "Record harvest"}
              </Button>
            </div>
            {cycle.harvest ? (
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Harvest date</dt>
                <dd className="text-right font-semibold">{formatDate(cycle.harvest.date)}</dd>
                <dt className="text-muted-foreground">Total harvested</dt>
                <dd className="text-right font-semibold">{cycle.harvest.quantityQtl} qtl</dd>
                <dt className="text-muted-foreground">Sold</dt>
                <dd className="text-right font-semibold">{cycle.harvest.soldQtl} qtl</dd>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="text-right font-semibold">{formatINR(cycle.harvest.sellingPricePerQtl)} / qtl</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No harvest recorded for this season yet.</p>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 text-lg">Cost breakdown</h3>
            {s.costByCategory.length ? <Donut title="Cost by category for this season" slices={s.costByCategory.map((c) => ({ label: EXPENSE_LABEL[c.category] ?? c.category, value: c.amount }))} centre={{ top: formatINR(s.totalCost), bottom: "total" }} /> : <p className="text-sm text-muted-foreground">No expenses yet.</p>}
          </Card>
        </div>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg">Expenses ({cycle.expenses.length})</h3>
          <Button size="sm" onClick={() => setAddExp(true)}>
            <Plus className="h-4 w-4" /> Add expense
          </Button>
        </div>
        {cycle.expenses.length === 0 ? (
          <EmptyState compact title="No expenses recorded" description="Add seed, fertiliser, labour and other costs to see your cost per quintal." />
        ) : (
          <ul className="divide-y">
            {cycle.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <Badge tone="neutral">{EXPENSE_LABEL[e.category] ?? e.category}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {formatDate(e.date, { day: "numeric", month: "short" })}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
                <span className="font-bold tabular-nums">{formatINR(e.amount)}</span>
                <button onClick={() => delExpense(e.id)} aria-label={`Delete ${EXPENSE_LABEL[e.category]} expense of ${e.amount} rupees`} className="tap grid place-items-center rounded-lg text-muted-foreground hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet open={addExp} onClose={() => setAddExp(false)} title="Add expense" description={`${cycle.cropName} · ${cycle.season} ${cycle.year}`}>
        <ExpenseForm cycleId={cycle.id} onDone={() => setAddExp(false)} />
      </Sheet>
      <Sheet open={harvest} onClose={() => setHarvest(false)} title="Harvest & sale" description="Revenue is calculated only from the quantity you've sold.">
        <HarvestForm cycle={cycle} onDone={() => setHarvest(false)} />
      </Sheet>
    </div>
  );
}

// ───────── /crops/[id] ─────────
export function CropDetailView({ id, cycleId }: { id: string; cycleId?: string }) {
  const q = useGet<CropDetailDTO>(`/crops/${id}`);
  const [sel, setSel] = useState<string | null>(cycleId ?? null);
  const [newCycle, setNewCycle] = useState(false);
  const [edit, setEdit] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  useEffect(() => {
    if (!sel && q.data?.cycles[0]) setSel(q.data.cycles[0].id);
  }, [q.data, sel]);
  const del = async () => {
    try {
      await api("DELETE", `/crops/${id}`);
      await invalidate("/crops", "/farms", "/farm/summary", "/home");
      toast({ title: "Crop deleted" });
      router.replace("/crops");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't delete", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(d) => {
        const cycle = d.cycles.find((c) => c.id === sel) ?? d.cycles[0];
        return (
          <div className="space-y-5">
            <Link href="/crops" className="text-sm font-semibold text-primary hover:underline">
              ← My crops
            </Link>
            <Card className="overflow-hidden">
              <div className="h-28 md:h-36">
                <Scene kind={sceneForCrop(d.crop.name)} />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div>
                  <h1>{d.crop.name}</h1>
                  <p className="mt-1 text-muted-foreground">
                    {d.crop.farmName} · {d.crop.season} · {d.crop.areaAcres} acres · {d.crop.method}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="success">{d.crop.status.charAt(0) + d.crop.status.slice(1).toLowerCase()}</Badge>
                    <Badge tone="neutral">
                      <Leaf className="h-3 w-3" aria-hidden /> {d.crop.experienceYears} yrs growing
                    </Badge>
                  </div>
                </div>
                {(
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button size="sm" onClick={() => setNewCycle(true)}>
                      <Plus className="h-4 w-4" /> New season
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {d.cycles.length === 0 ? (
              <Card>
                <EmptyState title="No seasons recorded" description="Start a season to track sowing, irrigation, costs and harvest." action={{ label: "Start a season", onClick: () => setNewCycle(true) }} />
              </Card>
            ) : (
              <>
                {d.comparison.length > 1 && (
                  <Card className="p-4">
                    <h2 className="mb-2 text-lg">Season comparison</h2>
                    <BarChart title={`${d.crop.name}: cost, revenue and profit by season`} series={["Cost", "Revenue", "Profit"]} data={d.comparison.map((c) => ({ label: c.label, values: [c.cost, c.revenue, Math.max(0, c.profit)] }))} />
                  </Card>
                )}
                <Tabs label="Season" value={cycle!.id} onChange={setSel} items={d.cycles.map((c) => ({ id: c.id, label: `${c.season} ${c.year}` }))} />
                {cycle && <CycleView cycle={cycle} />}
              </>
            )}

            <Sheet open={newCycle} onClose={() => setNewCycle(false)} title="Start a new season" description={d.crop.name}>
              <CycleForm cropId={d.crop.id} defaultArea={d.crop.areaAcres} onDone={(c) => { setNewCycle(false); setSel(c.id); }} />
            </Sheet>
            <Sheet open={edit} onClose={() => setEdit(false)} title="Edit crop" size="lg" footer={<Button variant="ghost" className="mr-auto text-danger" onClick={del}><Trash2 className="h-4 w-4" /> Delete crop</Button>}>
              <CropForm initial={d.crop} onDone={() => setEdit(false)} />
            </Sheet>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
