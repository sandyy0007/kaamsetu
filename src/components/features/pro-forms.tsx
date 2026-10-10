"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { TagInput } from "@/components/ui/tag-input";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { DISTRICT_NAMES } from "@/lib/geo";
import { businessSchema, recommendationSchema, serviceSchema, workHistorySchema, workOpportunitySchema, workPortfolioSchema, WORK_KIND_LIST } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { WORK_KINDS } from "@/types/domain";
import type { BusinessCardDTO, PortfolioEntryDTO, ProfessionalProfileDTO, ServiceDTO, WorkHistoryDTO, WorkOpportunityDTO } from "@/types/dto";
import { ImagePicker } from "./image-picker";
import { PAY_UNIT_LABEL, WORK_KIND_LABEL, useCatalog } from "./pro-shared";

/** The signed-in professional's own full profile (profession, skills, services suggestions…). */
export function useMyPro() {
  const { data: me } = useMe();
  const hasProfile = !!me && (me.role === "FARMER" || me.role === "PROFESSIONAL" || me.role === "EXPERT");
  return useGet<ProfessionalProfileDTO>(hasProfile ? "/professionals/me" : null, { staleTime: 60_000 });
}

function useSaver<T extends FieldValues>(f: UseFormReturn<T>, prefixes: string[]) {
  const toast = useToast();
  const invalidate = useInvalidate();
  return async <R,>(call: () => Promise<R>, success: string, onDone?: (r: R) => void) => {
    try {
      const r = await call();
      await invalidate(...prefixes);
      toast({ title: success });
      onDone?.(r);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        for (const [k, m] of Object.entries(e.fields)) f.setError(k as never, { message: m });
        toast({ kind: "error", title: "Please fix the highlighted fields" });
      } else if (e instanceof ApiClientError && e.code === "SENSITIVE_CONTENT") toast({ kind: "error", title: "Remove sensitive details", description: e.message });
      else toast({ kind: "error", title: "Couldn't save", description: e instanceof Error ? e.message : undefined });
    }
  };
}

const numOrUndef = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));

function FormActions({ busy, label, onCancel, onDelete }: { busy: boolean; label: string; onCancel?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      {onDelete && (
        <Button type="button" variant="ghost" className="mr-auto text-danger" onClick={onDelete}>
          Delete
        </Button>
      )}
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}

/** Toggle chips for choosing professions (catalog-driven; nothing hardcoded). */
export function ProfessionMultiPicker({ value, onChange, max = 5, label }: { value: string[]; onChange: (v: string[]) => void; max?: number; label: string }) {
  const { professions } = useCatalog();
  const [q, setQ] = useState("");
  const list = useMemo(() => professions.filter((p) => p.status === "ACTIVE" && (!q || `${p.name} ${p.nameHi}`.toLowerCase().includes(q.toLowerCase()))), [professions, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length >= max ? value : [...value, id]);
  return (
    <div>
      <Input type="search" aria-label={`Search ${label}`} placeholder="Search professions…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
      <ul className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label={label}>
        {list.map((p) => {
          const on = value.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={cn("tap inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors", on ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}>
                <span aria-hidden>{p.emoji}</span> {p.name}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {value.length}/{max} selected
      </p>
    </div>
  );
}

// ───────────── Service ─────────────
type ServiceValues = z.input<typeof serviceSchema>;
export function ServiceForm({ initial, onDone, onCancel }: { initial?: ServiceDTO; onDone?: (s: ServiceDTO) => void; onCancel?: () => void }) {
  const { data: pro } = useMyPro();
  const f = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: initial?.name ?? "", description: initial?.description ?? "", priceType: initial?.priceType ?? "NEGOTIABLE", price: initial?.price, areas: initial?.areas ?? [], availability: initial?.availability ?? "", active: initial?.active ?? true },
  });
  const save = useSaver(f, ["/services", "/my/work", "/professionals", "/home"]);
  const [image, setImage] = useState<string | undefined>();
  const priceType = f.watch("priceType");
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) =>
    save(() => (initial ? api<ServiceDTO>("PATCH", `/services/${initial.id}`, { ...v, imageUrl: image }) : api<ServiceDTO>("POST", "/services", { ...v, imageUrl: image })), initial ? "Service updated" : "Service added", onDone),
  );
  const remove = async () => {
    if (!initial) return;
    await save(() => api("DELETE", `/services/${initial.id}`), "Service removed", () => onDone?.(initial));
  };
  const suggestions = pro?.profession.suggestedServices ?? [];
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Service name" required error={e.name?.message}>
        {(a) => <Input {...a} {...f.register("name")} placeholder="e.g. House wiring" />}
      </Field>
      {!initial && suggestions.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Suggested services">
          {suggestions.slice(0, 6).map((s) => (
            <button type="button" key={s} onClick={() => f.setValue("name", s, { shouldValidate: true })} className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              + {s}
            </button>
          ))}
        </div>
      )}
      <Field label="What is included?" required error={e.description?.message}>
        {(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={800} placeholder="Say what you do, what tools or material you bring, and how you work." />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How do you charge?" required error={e.priceType?.message}>
          {(a) => (
            <Select {...a} {...f.register("priceType")}>
              <option value="NEGOTIABLE">To be discussed</option>
              <option value="FIXED">Fixed price</option>
              <option value="HOURLY">Per hour</option>
              <option value="DAILY">Per day</option>
              <option value="PER_VISIT">Per visit</option>
              <option value="MONTHLY">Per month</option>
            </Select>
          )}
        </Field>
        {priceType !== "NEGOTIABLE" && (
          <Field label="Price (₹)" required error={e.price?.message}>
            {(a) => <Input {...a} type="number" min={0} inputMode="numeric" {...f.register("price", { setValueAs: numOrUndef })} />}
          </Field>
        )}
      </div>
      <Controller control={f.control} name="areas" render={({ field, fieldState }) => <Field label="Areas you serve" error={fieldState.error?.message} hint="Towns or districts. Press Enter after each.">{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="e.g. Churu" suggestions={DISTRICT_NAMES.slice(0, 8)} max={15} />}</Field>} />
      <Field label="When are you available? (optional)" error={e.availability?.message}>
        {(a) => <Input {...a} {...f.register("availability")} placeholder="e.g. Mon–Sat, 9 am – 6 pm" maxLength={160} />}
      </Field>
      <Field label="Photo of your work (optional)">{() => <ImagePicker value={image} onChange={setImage} label="Add a photo" />}</Field>
      {initial && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" {...f.register("active")} className="h-4 w-4" /> Accepting requests for this service
        </label>
      )}
      <FormActions busy={f.formState.isSubmitting} label={initial ? "Save changes" : "Add service"} onCancel={onCancel} onDelete={initial ? remove : undefined} />
    </form>
  );
}

// ───────────── Portfolio ─────────────
type PortfolioValues = z.input<typeof workPortfolioSchema>;
export function PortfolioForm({ initial, onDone, onCancel }: { initial?: PortfolioEntryDTO; onDone?: (p: PortfolioEntryDTO) => void; onCancel?: () => void }) {
  const { data: pro } = useMyPro();
  const f = useForm<PortfolioValues>({
    resolver: zodResolver(workPortfolioSchema),
    defaultValues: { title: initial?.title ?? "", description: initial?.description ?? "", category: initial?.category ?? "", date: initial?.date?.slice(0, 10) ?? "", skillsUsed: initial?.skillsUsed ?? [] },
  });
  const save = useSaver(f, ["/professionals", "/my/work", "/home", "/farmers"]);
  const [image, setImage] = useState<string | undefined>(initial?.imageUrl);
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) =>
    save(() => (initial ? api<PortfolioEntryDTO>("PATCH", `/me/portfolio/${initial.id}`, { ...v, imageUrl: image }) : api<PortfolioEntryDTO>("POST", "/me/portfolio", { ...v, imageUrl: image })), initial ? "Portfolio updated" : "Added to your portfolio", onDone),
  );
  const remove = async () => {
    if (!initial) return;
    await save(() => api("DELETE", `/me/portfolio/${initial.id}`), "Removed from portfolio", () => onDone?.(initial));
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Project / work title" required error={e.title?.message}>
        {(a) => <Input {...a} {...f.register("title")} placeholder="e.g. Full house re-wiring, Ratangarh" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required error={e.category?.message}>
          {(a) => <Input {...a} {...f.register("category")} list="portfolio-cats" placeholder="e.g. House wiring" />}
        </Field>
        <Field label="When was it done?" required error={e.date?.message}>
          {(a) => <Input {...a} type="date" max={new Date().toISOString().slice(0, 10)} {...f.register("date")} />}
        </Field>
      </div>
      <datalist id="portfolio-cats">{(pro?.profession.suggestedServices ?? []).map((s) => <option key={s} value={s} />)}</datalist>
      <Field label="About this work" required error={e.description?.message}>
        {(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={800} placeholder="What was the job, what did you do, and what was the result?" />}
      </Field>
      <Controller control={f.control} name="skillsUsed" render={({ field, fieldState }) => <Field label="Skills used" error={fieldState.error?.message}>{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="e.g. Earthing" suggestions={pro?.skills.map((s) => s.name)} max={12} />}</Field>} />
      <Field label="Photo (optional)">{() => <ImagePicker value={image} onChange={setImage} label="Add a photo of the finished work" />}</Field>
      <Notice tone="info">Only share work you did yourself. Don&apos;t include customers&apos; phone numbers or exact addresses.</Notice>
      <FormActions busy={f.formState.isSubmitting} label={initial ? "Save changes" : "Add to portfolio"} onCancel={onCancel} onDelete={initial ? remove : undefined} />
    </form>
  );
}

// ───────────── Work history ─────────────
type HistoryValues = z.input<typeof workHistorySchema>;
const WORK_KIND_TEXT: Record<(typeof WORK_KIND_LIST)[number], string> = { EMPLOYMENT: "Employment", SELF_EMPLOYED: "Self-employed", FAMILY: "Family work", INDEPENDENT: "Independent / freelance", SEASONAL: "Seasonal", CONTRACT: "Contract", APPRENTICESHIP: "Apprenticeship" };
export function WorkHistoryForm({ initial, onDone, onCancel }: { initial?: WorkHistoryDTO; onDone?: (w: WorkHistoryDTO) => void; onCancel?: () => void }) {
  const f = useForm<HistoryValues>({
    resolver: zodResolver(workHistorySchema),
    defaultValues: { role: initial?.role ?? "", organization: initial?.organization ?? "", kind: initial?.kind ?? "SELF_EMPLOYED", location: initial?.location ?? "", startDate: initial?.startDate ?? "", endDate: initial?.endDate ?? "", description: initial?.description ?? "", skills: initial?.skills ?? [] },
  });
  const save = useSaver(f, ["/professionals", "/my/work"]);
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) => save(() => (initial ? api<WorkHistoryDTO>("PATCH", `/me/work-history/${initial.id}`, v) : api<WorkHistoryDTO>("POST", "/me/work-history", v)), initial ? "Experience updated" : "Experience added", onDone));
  const remove = async () => {
    if (!initial) return;
    await save(() => api("DELETE", `/me/work-history/${initial.id}`), "Experience removed", () => onDone?.(initial));
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your role" required error={e.role?.message}>
          {(a) => <Input {...a} {...f.register("role")} placeholder="e.g. Electrician" />}
        </Field>
        <Field label="Organisation or client" required error={e.organization?.message} hint="Your own shop, a family farm, a contractor…">
          {(a) => <Input {...a} {...f.register("organization")} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of work" required error={e.kind?.message}>
          {(a) => (
            <Select {...a} {...f.register("kind")}>
              {WORK_KIND_LIST.map((k) => (
                <option key={k} value={k}>
                  {WORK_KIND_TEXT[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Place" error={e.location?.message}>
          {(a) => <Input {...a} {...f.register("location")} placeholder="e.g. Churu" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started" required error={e.startDate?.message}>
          {(a) => <Input {...a} type="month" {...f.register("startDate")} />}
        </Field>
        <Field label="Ended" hint="Leave empty if you still do this work." error={e.endDate?.message}>
          {(a) => <Input {...a} type="month" {...f.register("endDate")} />}
        </Field>
      </div>
      <Field label="What did you do?" error={e.description?.message}>
        {(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={600} />}
      </Field>
      <Controller control={f.control} name="skills" render={({ field, fieldState }) => <Field label="Skills used" error={fieldState.error?.message}>{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="Press Enter after each skill" max={10} />}</Field>} />
      <FormActions busy={f.formState.isSubmitting} label={initial ? "Save changes" : "Add experience"} onCancel={onCancel} onDelete={initial ? remove : undefined} />
    </form>
  );
}

// ───────────── Post an opportunity ─────────────
type OppValues = z.input<typeof workOpportunitySchema>;
export function OpportunityForm({ initial, defaultProfessionIds, onDone, onCancel }: { initial?: WorkOpportunityDTO; defaultProfessionIds?: string[]; onDone?: (w: WorkOpportunityDTO) => void; onCancel?: () => void }) {
  const { data: me } = useMe();
  const { professions } = useCatalog();
  const biz = useGet<{ items: BusinessCardDTO[] }>(me ? "/businesses?mine=1" : null);
  const f = useForm<OppValues>({
    resolver: zodResolver(workOpportunitySchema),
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      kind: initial?.kind ?? "DAILY",
      professionIds: initial?.professions.map((p) => p.id) ?? defaultProfessionIds ?? [],
      skills: initial?.skills ?? [],
      openings: initial?.openings ?? 1,
      village: "",
      district: initial?.district ?? me?.district ?? "",
      state: "Rajasthan",
      startDate: initial?.startDate?.slice(0, 10) ?? "",
      mode: initial?.mode ?? "ONSITE",
      payUnit: (initial?.pay.unit as OppValues["payUnit"]) ?? "NEGOTIABLE",
      payMin: initial?.pay.min,
      payMax: initial?.pay.max,
      duration: initial?.duration ?? "",
      contactMethod: initial?.contactMethod ?? "IN_APP",
      businessId: initial?.business?.id ?? "",
    },
  });
  const save = useSaver(f, ["/work", "/my/work", "/opportunities", "/home", "/businesses"]);
  const payUnit = f.watch("payUnit");
  const watchedProfessions = f.watch("professionIds");
  const suggested = useMemo(() => {
    const chosen = watchedProfessions ?? [];
    return Array.from(new Set(professions.filter((p) => chosen.includes(p.id)).flatMap((p) => p.suggestedSkills))).slice(0, 10);
  }, [professions, watchedProfessions]);
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) => {
    const body = { ...v, businessId: v.businessId || undefined, startDate: v.startDate || undefined, village: v.village || undefined };
    return save(() => (initial ? api<WorkOpportunityDTO>("PATCH", `/work/${initial.id}`, body) : api<WorkOpportunityDTO>("POST", "/work", body)), initial ? "Opportunity updated" : "Opportunity posted", onDone);
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice tone="info">Describe the work clearly. Applicants message you inside KaamSetu — your phone number is shared only if you choose phone contact <em>and</em> accept that person. KaamSetu does not handle payments.</Notice>
      <Field label="Title" required error={e.title?.message}>
        {(a) => <Input {...a} {...f.register("title")} placeholder="e.g. Electrician needed for 2-storey house wiring" />}
      </Field>
      <Field label="Details" required error={e.description?.message}>
        {(a) => <Textarea {...a} {...f.register("description")} rows={4} maxLength={1500} placeholder="What work, how long, any tools or experience needed?" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type of work" required error={e.kind?.message}>
          {(a) => (
            <Select {...a} {...f.register("kind")}>
              {WORK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {WORK_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="How many people?" required error={e.openings?.message}>
          {(a) => <Input {...a} type="number" min={1} inputMode="numeric" {...f.register("openings", { valueAsNumber: true })} />}
        </Field>
      </div>
      <Controller control={f.control} name="professionIds" render={({ field, fieldState }) => <Field label="Who are you looking for?" required error={fieldState.error?.message}>{() => <ProfessionMultiPicker label="Professions needed" value={(field.value as string[]) ?? []} onChange={field.onChange} />}</Field>} />
      <Controller control={f.control} name="skills" render={({ field, fieldState }) => <Field label="Skills needed" error={fieldState.error?.message}>{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="Press Enter after each skill" suggestions={suggested} max={12} />}</Field>} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="District" required error={e.district?.message}>
          {(a) => (
            <Select {...a} {...f.register("district")}>
              <option value="">Choose district</option>
              {DISTRICT_NAMES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Village / area (optional)" error={e.village?.message} hint="Shown only to you. Applicants see the district.">
          {(a) => <Input {...a} {...f.register("village")} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date" error={e.startDate?.message}>
          {(a) => <Input {...a} type="date" min={new Date().toISOString().slice(0, 10)} {...f.register("startDate")} />}
        </Field>
        <Field label="Duration" error={e.duration?.message}>
          {(a) => <Input {...a} {...f.register("duration")} placeholder="e.g. 3 days" maxLength={80} />}
        </Field>
        <Field label="Where" error={e.mode?.message}>
          {(a) => (
            <Select {...a} {...f.register("mode")}>
              <option value="ONSITE">On site</option>
              <option value="REMOTE">Remote</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pay" required error={e.payUnit?.message}>
          {(a) => (
            <Select {...a} {...f.register("payUnit")}>
              {Object.entries(PAY_UNIT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {payUnit !== "NEGOTIABLE" && (
          <>
            <Field label="From (₹)" required error={e.payMin?.message}>
              {(a) => <Input {...a} type="number" min={0} inputMode="numeric" {...f.register("payMin", { setValueAs: numOrUndef })} />}
            </Field>
            <Field label="Up to (₹)" error={e.payMax?.message}>
              {(a) => <Input {...a} type="number" min={0} inputMode="numeric" {...f.register("payMax", { setValueAs: numOrUndef })} />}
            </Field>
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How should people reach you?" error={e.contactMethod?.message}>
          {(a) => (
            <Select {...a} {...f.register("contactMethod")}>
              <option value="IN_APP">Messages in KaamSetu (recommended)</option>
              <option value="PHONE">Share my phone with accepted applicants</option>
            </Select>
          )}
        </Field>
        {biz.data && biz.data.items.length > 0 && (
          <Field label="Post as" error={e.businessId?.message}>
            {(a) => (
              <Select {...a} {...f.register("businessId")}>
                <option value="">Myself</option>
                {biz.data.items.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
      <FormActions busy={f.formState.isSubmitting} label={initial ? "Save changes" : "Post opportunity"} onCancel={onCancel} />
    </form>
  );
}

// ───────────── Business ─────────────
type BizValues = z.input<typeof businessSchema>;
export function BusinessForm({ initial, onDone, onCancel }: { initial?: BusinessCardDTO; onDone?: (b: BusinessCardDTO) => void; onCancel?: () => void }) {
  const { data: me } = useMe();
  const f = useForm<BizValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: initial?.name ?? "", kind: initial?.kind ?? "", about: initial?.about ?? "", services: initial?.services ?? [], professionIds: initial?.professions.map((p) => p.id) ?? [], district: initial?.district ?? me?.district ?? "", state: "Rajasthan", website: initial?.website ?? "" },
  });
  const save = useSaver(f, ["/businesses", "/professionals", "/my/work"]);
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) => save(() => (initial ? api<BusinessCardDTO>("PATCH", `/businesses/${initial.id}`, v) : api<BusinessCardDTO>("POST", "/businesses", v)), initial ? "Business updated" : "Business added", onDone));
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice tone="info">A business page lists your services, publishes opportunities and shows your team. Its verified badge is granted only by KaamSetu admins after review.</Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required error={e.name?.message}>
          {(a) => <Input {...a} {...f.register("name")} />}
        </Field>
        <Field label="Type of business" required error={e.kind?.message}>
          {(a) => <Input {...a} {...f.register("kind")} placeholder="e.g. Construction contractor" />}
        </Field>
      </div>
      <Field label="About" required error={e.about?.message}>
        {(a) => <Textarea {...a} {...f.register("about")} rows={3} maxLength={800} />}
      </Field>
      <Controller control={f.control} name="services" render={({ field, fieldState }) => <Field label="Services you offer" error={fieldState.error?.message}>{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder="Press Enter after each service" max={15} />}</Field>} />
      <Controller control={f.control} name="professionIds" render={({ field }) => <Field label="Professions you work with or hire">{() => <ProfessionMultiPicker label="Professions" value={(field.value as string[]) ?? []} onChange={field.onChange} max={8} />}</Field>} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="District" required error={e.district?.message}>
          {(a) => (
            <Select {...a} {...f.register("district")}>
              <option value="">Choose district</option>
              {DISTRICT_NAMES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Website (optional)" error={e.website?.message}>
          {(a) => <Input {...a} type="url" {...f.register("website")} placeholder="https://" />}
        </Field>
      </div>
      <FormActions busy={f.formState.isSubmitting} label={initial ? "Save changes" : "Add business"} onCancel={onCancel} />
    </form>
  );
}

// ───────────── Recommendation ─────────────
type RecValues = z.input<typeof recommendationSchema>;
export function RecommendationForm({ professionalId, skills, onDone, onCancel }: { professionalId: string; skills?: string[]; onDone?: () => void; onCancel?: () => void }) {
  const f = useForm<RecValues>({ resolver: zodResolver(recommendationSchema), defaultValues: { relationship: "CUSTOMER", body: "", skill: "" } });
  const save = useSaver(f, ["/professionals"]);
  const e = f.formState.errors;
  const submit = f.handleSubmit((v) => save(() => api("POST", `/professionals/${professionalId}/recommendations`, { ...v, skill: v.skill || undefined }), "Recommendation posted", () => onDone?.()));
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice tone="info">Write only what you know first-hand. Recommendations are shown with your name, and are marked &ldquo;confirmed&rdquo; only when you have actually worked together on KaamSetu.</Notice>
      <Field label="How do you know them?" required error={e.relationship?.message}>
        {(a) => (
          <Select {...a} {...f.register("relationship")}>
            <option value="CUSTOMER">I was their customer</option>
            <option value="COLLEAGUE">We worked together</option>
            <option value="EMPLOYER">I hired them</option>
            <option value="NEIGHBOUR">Neighbour / local</option>
            <option value="TRAINER">I trained or taught them</option>
            <option value="OTHER">Other</option>
          </Select>
        )}
      </Field>
      <Field label="Your recommendation" required error={e.body?.message}>
        {(a) => <Textarea {...a} {...f.register("body")} rows={4} maxLength={600} placeholder="What work did they do for you? How was it?" />}
      </Field>
      <Field label="Skill it relates to (optional)" error={e.skill?.message}>
        {(a) => <Input {...a} {...f.register("skill")} list="rec-skills" />}
      </Field>
      <datalist id="rec-skills">{(skills ?? []).map((s) => <option key={s} value={s} />)}</datalist>
      <FormActions busy={f.formState.isSubmitting} label="Post recommendation" onCancel={onCancel} />
    </form>
  );
}
