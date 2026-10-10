"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import { CROPS, EXPENSE_LABEL, FARMING_METHODS, IRRIGATION_TYPES, SOIL_TYPES } from "@/lib/constants";
import { DISTRICT_NAMES } from "@/lib/geo";
import { cropSchema, cycleStartSchema, expenseSchema, farmSchema, harvestSchema, type CropInput, type CycleStartInput, type ExpenseInput, type FarmInput, type HarvestInput } from "@/lib/schemas";
import { EXPENSE_CATEGORIES } from "@/types/domain";
import type { CropDTO, CycleDTO, FarmDTO } from "@/types/dto";

function useSubmit<T extends Record<string, unknown>, R>(call: (v: T) => Promise<R>, onDone: (r: R) => void, setError: (name: never, e: { message: string }) => void, prefixes: string[], successTitle: string) {
  const toast = useToast();
  const invalidate = useInvalidate();
  return async (v: T) => {
    try {
      const r = await call(v);
      await invalidate(...prefixes);
      toast({ title: successTitle });
      onDone(r);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as never, { message: m });
      else toast({ kind: "error", title: "Couldn't save", description: e instanceof Error ? e.message : undefined });
    }
  };
}

const FARM_KEYS = ["/farms", "/farm/summary", "/crops", "/home", "/profile", "/farmers"];

export function FarmForm({ initial, onDone, id = "farm-form" }: { initial?: FarmDTO; onDone: (f: FarmDTO) => void; id?: string }) {
  const f = useForm<FarmInput>({ resolver: zodResolver(farmSchema), defaultValues: { name: initial?.name ?? "", areaAcres: initial?.areaAcres ?? (undefined as unknown as number), soil: initial?.soil ?? SOIL_TYPES[0], irrigation: initial?.irrigation ?? IRRIGATION_TYPES[0], village: initial?.village ?? "", district: initial?.district ?? "" } });
  const submit = useSubmit((v: FarmInput) => (initial ? api<FarmDTO>("PATCH", `/farms/${initial.id}`, v) : api<FarmDTO>("POST", "/farms", v)), onDone, f.setError as never, FARM_KEYS, initial ? "Farm updated" : "Farm added");
  const e = f.formState.errors;
  return (
    <form id={id} onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
      <Field label="Farm name" required error={e.name?.message}>{(a) => <Input {...a} {...f.register("name")} placeholder="e.g. Main field, Canal-side plot" />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area (acres)" required error={e.areaAcres?.message}>{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("areaAcres", { valueAsNumber: true })} />}</Field>
        <Field label="Soil type" required error={e.soil?.message}>
          {(a) => (
            <Select {...a} {...f.register("soil")}>
              {SOIL_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Irrigation" required error={e.irrigation?.message}>
          {(a) => (
            <Select {...a} {...f.register("irrigation")}>
              {IRRIGATION_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Village" required error={e.village?.message}>{(a) => <Input {...a} {...f.register("village")} />}</Field>
        <Field label="District" required error={e.district?.message}>
          {(a) => (
            <>
              <Input {...a} list="farm-districts" {...f.register("district")} />
              <datalist id="farm-districts">
                {DISTRICT_NAMES.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>
      <Button type="submit" loading={f.formState.isSubmitting} className="w-full sm:w-auto">
        {initial ? "Save farm" : "Add farm"}
      </Button>
    </form>
  );
}

export function CropForm({ initial, defaultFarmId, onDone, id = "crop-form" }: { initial?: CropDTO; defaultFarmId?: string; onDone: (c: CropDTO) => void; id?: string }) {
  const farms = useGet<FarmDTO[]>("/farms");
  const f = useForm<CropInput>({ resolver: zodResolver(cropSchema), defaultValues: { farmId: initial?.farmId ?? defaultFarmId ?? "", name: initial?.name ?? "", experienceYears: initial?.experienceYears ?? 1, season: initial?.season ?? "Rabi", areaAcres: initial?.areaAcres ?? (undefined as unknown as number), method: initial?.method ?? FARMING_METHODS[0], typicalYieldQtlPerAcre: initial?.typicalYieldQtlPerAcre ?? 0 } });
  const submit = useSubmit((v: CropInput) => (initial ? api<CropDTO>("PATCH", `/crops/${initial.id}`, v) : api<CropDTO>("POST", "/crops", v)), onDone, f.setError as never, FARM_KEYS, initial ? "Crop updated" : "Crop added");
  const e = f.formState.errors;
  return (
    <form id={id} onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Farm" required error={e.farmId?.message} hint={farms.data?.length === 0 ? "Add a farm first" : undefined}>
          {(a) => (
            <Select {...a} {...f.register("farmId")}>
              <option value="">Select a farm…</option>
              {farms.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.areaAcres} acres)
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Crop" required error={e.name?.message}>
          {(a) => (
            <>
              <Input {...a} list="crop-names" {...f.register("name")} placeholder="e.g. Mustard" />
              <datalist id="crop-names">
                {CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Season" required error={e.season?.message}>
          {(a) => (
            <Select {...a} {...f.register("season")}>
              {["Rabi", "Kharif", "Zaid"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Area (acres)" required error={e.areaAcres?.message}>{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("areaAcres", { valueAsNumber: true })} />}</Field>
        <Field label="Farming method" required error={e.method?.message}>
          {(a) => (
            <Select {...a} {...f.register("method")}>
              {FARMING_METHODS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Years growing this crop" required error={e.experienceYears?.message}>{(a) => <Input {...a} type="number" inputMode="numeric" {...f.register("experienceYears", { valueAsNumber: true })} />}</Field>
        <Field label="Typical yield (quintal / acre)" error={e.typicalYieldQtlPerAcre?.message} hint="Your own estimate. Leave 0 if unsure.">{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("typicalYieldQtlPerAcre", { valueAsNumber: true })} />}</Field>
      </div>
      <Button type="submit" loading={f.formState.isSubmitting} className="w-full sm:w-auto">
        {initial ? "Save crop" : "Add crop"}
      </Button>
    </form>
  );
}

export function CycleForm({ cropId, defaultArea, onDone }: { cropId: string; defaultArea: number; onDone: (c: CycleDTO) => void }) {
  const year = new Date().getFullYear();
  const f = useForm<CycleStartInput>({ resolver: zodResolver(cycleStartSchema), defaultValues: { season: "Rabi", year, areaAcres: defaultArea, seed: "" } });
  const submit = useSubmit((v: CycleStartInput) => api<CycleDTO>("POST", `/crops/${cropId}/cycles`, v), onDone, f.setError as never, ["/crops", "/farms", "/farm/summary", "/home"], "Season started");
  const e = f.formState.errors;
  return (
    <form id="cycle-form" onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Season" required error={e.season?.message}>
          {(a) => (
            <Select {...a} {...f.register("season")}>
              {["Rabi", "Kharif", "Zaid"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Year" required error={e.year?.message}>{(a) => <Input {...a} type="number" {...f.register("year", { valueAsNumber: true })} />}</Field>
        <Field label="Area (acres)" required error={e.areaAcres?.message}>{(a) => <Input {...a} type="number" step="0.1" {...f.register("areaAcres", { valueAsNumber: true })} />}</Field>
      </div>
      <Field label="Seed / variety (optional)" error={e.seed?.message}>{(a) => <Input {...a} {...f.register("seed")} placeholder="e.g. Pusa Mustard 30" />}</Field>
      <Button type="submit" loading={f.formState.isSubmitting}>
        Start season
      </Button>
    </form>
  );
}

export function ExpenseForm({ cycleId, onDone }: { cycleId: string; onDone: (c: CycleDTO) => void }) {
  const f = useForm<ExpenseInput>({ resolver: zodResolver(expenseSchema), defaultValues: { category: "SEED", amount: undefined as unknown as number, date: new Date().toISOString().slice(0, 10), note: "" } });
  const submit = useSubmit((v: ExpenseInput) => api<CycleDTO>("POST", `/cycles/${cycleId}/expenses`, v), (c) => { f.reset({ category: "SEED", amount: undefined as unknown as number, date: new Date().toISOString().slice(0, 10), note: "" }); onDone(c); }, f.setError as never, ["/crops", "/farms", "/farm/summary", "/home"], "Expense added");
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required error={e.category?.message}>
          {(a) => (
            <Select {...a} {...f.register("category")}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount (₹)" required error={e.amount?.message}>{(a) => <Input {...a} type="number" inputMode="numeric" min={1} {...f.register("amount", { valueAsNumber: true })} />}</Field>
        <Field label="Date" required error={e.date?.message}>{(a) => <Input {...a} type="date" {...f.register("date")} />}</Field>
        <Field label="Note (optional)" error={e.note?.message}>{(a) => <Input {...a} {...f.register("note")} placeholder="e.g. DAP 4 bags" />}</Field>
      </div>
      <Button type="submit" loading={f.formState.isSubmitting}>
        Add expense
      </Button>
      <p className="text-xs text-muted-foreground">Expenses are private to you and never shown on your public profile.</p>
    </form>
  );
}

export function HarvestForm({ cycle, onDone }: { cycle: CycleDTO; onDone: (c: CycleDTO) => void }) {
  const h = cycle.harvest;
  const f = useForm<HarvestInput>({ resolver: zodResolver(harvestSchema), defaultValues: { date: h?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10), quantityQtl: h?.quantityQtl ?? (undefined as unknown as number), soldQtl: h?.soldQtl ?? 0, sellingPricePerQtl: h?.sellingPricePerQtl ?? 0 } });
  const submit = useSubmit((v: HarvestInput) => api<CycleDTO>("PUT", `/cycles/${cycle.id}/harvest`, v), onDone, f.setError as never, ["/crops", "/farms", "/farm/summary", "/home"], "Harvest saved");
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Harvest date" required error={e.date?.message}>{(a) => <Input {...a} type="date" {...f.register("date")} />}</Field>
        <Field label="Total harvested (quintal)" required error={e.quantityQtl?.message}>{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("quantityQtl", { valueAsNumber: true })} />}</Field>
        <Field label="Quantity sold (quintal)" required error={e.soldQtl?.message} hint="Revenue counts only what you have sold.">{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("soldQtl", { valueAsNumber: true })} />}</Field>
        <Field label="Selling price (₹ / quintal)" required error={e.sellingPricePerQtl?.message}>{(a) => <Input {...a} type="number" inputMode="numeric" {...f.register("sellingPricePerQtl", { valueAsNumber: true })} />}</Field>
      </div>
      <Button type="submit" loading={f.formState.isSubmitting}>
        {h ? "Update harvest" : "Save harvest"}
      </Button>
    </form>
  );
}
