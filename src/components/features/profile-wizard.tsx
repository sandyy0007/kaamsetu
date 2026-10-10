"use client";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice, PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { QueryBoundary } from "@/components/ui/state";
import { TagInput } from "@/components/ui/tag-input";
import { useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { LANGUAGE_OPTIONS, VISIBILITY_LABEL } from "@/lib/constants";
import { DISTRICT_NAMES } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { AttributeField, AvailabilityStatus, SkillLevel, Visibility, WorkPreference } from "@/types/domain";
import type { ProfessionalProfileDTO } from "@/types/dto";
import { ImagePicker } from "./image-picker";
import { ProfessionPicker, type ProfessionChoice } from "./profession-picker";
import { useMyPro } from "./pro-forms";
import { WEEK_DAYS, WORK_PREFERENCE_LABEL, useCatalog } from "./pro-shared";

// ───────────── draft state shared by the wizard and the edit page ─────────────
interface Draft {
  choice: ProfessionChoice;
  years: string;
  about: string;
  headline: string;
  languages: string[];
  skills: { name: string; level: SkillLevel; years?: number }[];
  attributes: Record<string, string | string[] | number>;
  services: { name: string; priceType: "NEGOTIABLE" | "FIXED" | "HOURLY" | "DAILY" | "PER_VISIT" | "MONTHLY"; price: string }[];
  village: string;
  district: string;
  state: string;
  radius: string;
  areas: string[];
  status: AvailabilityStatus;
  days: string[];
  preferences: WorkPreference[];
  note: string;
  wage: string;
  wageUnit: "HOUR" | "DAY" | "MONTH" | "PROJECT";
  portfolio: { title: string; category: string; description: string; imageUrl?: string };
  visProfile: Visibility;
  visPhone: Visibility;
  precision: "VILLAGE" | "DISTRICT";
}

const THIS_YEAR = new Date().getFullYear();
const LEVELS: { id: SkillLevel; label: string }[] = [
  { id: "BEGINNER", label: "Beginner" },
  { id: "INTERMEDIATE", label: "Good" },
  { id: "EXPERT", label: "Expert" },
];
const STATUSES: { id: AvailabilityStatus; label: string; hint: string }[] = [
  { id: "AVAILABLE", label: "Available for work", hint: "Show me to people who need work done" },
  { id: "OPEN_TO_WORK", label: "Open to opportunities", hint: "Employed or busy, but listening" },
  { id: "BUSY", label: "Busy right now", hint: "Visible, but marked as busy" },
  { id: "NOT_AVAILABLE", label: "Not available", hint: "Don't offer me work for now" },
];

function emptyDraft(me?: { district?: string }): Draft {
  return {
    choice: {},
    years: "",
    about: "",
    headline: "",
    languages: ["Hindi"],
    skills: [],
    attributes: {},
    services: [],
    village: "",
    district: me?.district ?? "",
    state: "Rajasthan",
    radius: "25",
    areas: [],
    status: "AVAILABLE",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    preferences: ["DAILY", "CONTRACT"],
    note: "",
    wage: "",
    wageUnit: "DAY",
    portfolio: { title: "", category: "", description: "" },
    visProfile: "PUBLIC",
    visPhone: "CONNECTIONS",
    precision: "DISTRICT",
  };
}

function fromProfile(p: ProfessionalProfileDTO, base: Draft): Draft {
  return {
    ...base,
    choice: p.customProfession ? { customProfession: p.customProfession } : { professionId: p.profession.id },
    years: String(p.experienceYears),
    about: p.about,
    headline: p.user.headline ?? "",
    languages: p.languages.length ? p.languages : base.languages,
    skills: p.skills.map((s) => ({ name: s.name, level: s.level, years: s.years })),
    attributes: p.attributes,
    village: p.village ?? "",
    district: p.district || base.district,
    state: p.state || base.state,
    radius: String(p.serviceRadiusKm ?? base.radius),
    areas: p.serviceAreas,
    status: p.availability?.status ?? base.status,
    days: p.availability?.days ?? base.days,
    preferences: p.availability?.preferences ?? base.preferences,
    note: p.availability?.note ?? "",
    wage: p.availability?.expectedWage ? String(p.availability.expectedWage.amount) : "",
    wageUnit: (p.availability?.expectedWage?.unit as Draft["wageUnit"]) ?? "DAY",
    visProfile: p.privacy?.profile ?? base.visProfile,
    visPhone: p.privacy?.phone ?? base.visPhone,
    precision: p.privacy?.locationPrecision ?? base.precision,
  };
}

type Setter = (patch: Partial<Draft>) => void;
interface StepProps {
  d: Draft;
  set: Setter;
  pro: ProfessionalProfileDTO;
  errors: Record<string, string>;
  /** Services are added on the profile itself in edit mode. */
  mode: "create" | "edit";
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("tap inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors", on ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}>
      {on && <Check className="h-3.5 w-3.5" aria-hidden />} {children}
    </button>
  );
}
const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// ───────────── the eight steps ─────────────
function useProfession(d: Draft, pro: ProfessionalProfileDTO) {
  const { byId } = useCatalog();
  return (d.choice.professionId ? byId(d.choice.professionId) : undefined) ?? pro.profession;
}

function StepProfession({ d, set, pro, errors }: StepProps) {
  const isFarmer = pro.profession.farmModules;
  if (isFarmer)
    return (
      <Notice tone="info" title="🌾 You joined as a farmer">
        Your farms, crops and produce stay exactly as they are. The steps below add your skills, services and portfolio on top.
      </Notice>
    );
  return (
    <div>
      <ProfessionPicker value={d.choice} onChange={(choice) => set({ choice })} autoFocus />
      {errors.choice && <p role="alert" className="mt-2 text-sm font-semibold text-danger">{errors.choice}</p>}
    </div>
  );
}

function StepExperience({ d, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label="How many years have you been doing this work?" required error={errors.years} hint="Include family work and self-taught years.">
        {(a) => <Input {...a} type="number" min={0} max={70} inputMode="numeric" value={d.years} onChange={(e) => set({ years: e.target.value })} className="max-w-[10rem]" />}
      </Field>
      <Field label="Tell people about your work" error={errors.about} hint="Two or three lines are enough. What do you do best?">
        {(a) => <Textarea {...a} rows={4} maxLength={1200} value={d.about} onChange={(e) => set({ about: e.target.value })} placeholder="e.g. I have been doing house wiring and repairs for 12 years in and around Churu." />}
      </Field>
      <Field label="Languages you speak">
        {(a) => <TagInput id={a.id} value={d.languages} onChange={(languages) => set({ languages })} suggestions={LANGUAGE_OPTIONS} max={8} placeholder="Press Enter after each language" />}
      </Field>
    </div>
  );
}

function AttributeInputs({ fields, values, onChange }: { fields: AttributeField[]; values: Draft["attributes"]; onChange: (v: Draft["attributes"]) => void }) {
  if (!fields.length) return null;
  const setKey = (k: string, v: string | string[] | number | undefined) => {
    const next = { ...values };
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
    else next[k] = v;
    onChange(next);
  };
  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-semibold text-muted-foreground">More about your work</p>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint}>
          {(a) =>
            f.type === "chips" ? (
              <TagInput id={a.id} value={Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []} onChange={(v) => setKey(f.key, v)} suggestions={f.options} placeholder={f.placeholder ?? "Press Enter after each"} max={12} />
            ) : f.type === "select" ? (
              <Select {...a} value={String(values[f.key] ?? "")} onChange={(e) => setKey(f.key, e.target.value)}>
                <option value="">Choose…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : f.type === "number" ? (
              <Input {...a} type="number" inputMode="numeric" value={values[f.key] === undefined ? "" : String(values[f.key])} onChange={(e) => setKey(f.key, e.target.value === "" ? undefined : Number(e.target.value))} className="max-w-[10rem]" />
            ) : (
              <Input {...a} value={String(values[f.key] ?? "")} onChange={(e) => setKey(f.key, e.target.value)} placeholder={f.placeholder} maxLength={120} />
            )
          }
        </Field>
      ))}
    </div>
  );
}

function StepSkills({ d, set, pro }: StepProps) {
  const prof = useProfession(d, pro);
  const names = d.skills.map((s) => s.name);
  const setNames = (next: string[]) => set({ skills: next.map((n) => d.skills.find((s) => s.name.toLowerCase() === n.toLowerCase()) ?? { name: n, level: "INTERMEDIATE" as SkillLevel }) });
  return (
    <div className="space-y-4">
      <Field label="Your skills" hint="Add up to 25. Tap a suggestion or type your own.">
        {(a) => <TagInput id={a.id} value={names} onChange={setNames} suggestions={prof.suggestedSkills} max={25} placeholder="Type a skill and press Enter" />}
      </Field>
      {d.skills.length > 0 && (
        <ul className="space-y-2" aria-label="How good are you at each skill?">
          {d.skills.map((s, i) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5">
              <span className="font-semibold">{s.name}</span>
              <span className="inline-flex gap-1" role="radiogroup" aria-label={`Level of ${s.name}`}>
                {LEVELS.map((l) => (
                  <button key={l.id} type="button" role="radio" aria-checked={s.level === l.id} onClick={() => set({ skills: d.skills.map((x, j) => (j === i ? { ...x, level: l.id } : x)) })} className={cn("tap rounded-lg border px-2.5 text-xs font-semibold", s.level === l.id ? "border-primary bg-primary/12 text-primary" : "hover:bg-muted")}>
                    {l.label}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">A “verified” tick on a skill is added only by KaamSetu after checking — you can&apos;t add it yourself.</p>
      <AttributeInputs fields={prof.attributes} values={d.attributes} onChange={(attributes) => set({ attributes })} />
    </div>
  );
}

const PRICE_TYPES = [
  ["NEGOTIABLE", "To be discussed"],
  ["FIXED", "Fixed price"],
  ["HOURLY", "Per hour"],
  ["DAILY", "Per day"],
  ["PER_VISIT", "Per visit"],
  ["MONTHLY", "Per month"],
] as const;

function StepServices({ d, set, pro, mode }: StepProps) {
  const prof = useProfession(d, pro);
  const [name, setName] = useState("");
  if (mode === "edit")
    return (
      <p className="text-sm text-muted-foreground">
        Manage your services from the <strong>Services</strong> tab of your profile.
      </p>
    );
  const add = (n: string) => {
    const t = n.trim();
    if (t.length < 2 || d.services.some((s) => s.name.toLowerCase() === t.toLowerCase()) || d.services.length >= 8) return;
    set({ services: [...d.services, { name: t, priceType: "NEGOTIABLE", price: "" }] });
    setName("");
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Services are what people can ask you to do. You can skip this and add them later.</p>
      <div className="flex flex-wrap gap-1.5">
        {prof.suggestedServices.slice(0, 8).map((s) => (
          <button key={s} type="button" disabled={d.services.some((x) => x.name === s)} onClick={() => add(s)} className="tap inline-flex items-center gap-1 rounded-full border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" aria-hidden /> {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input aria-label="Add your own service" placeholder="Or type your own service" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(name); } }} />
        <Button type="button" variant="outline" onClick={() => add(name)}>
          Add
        </Button>
      </div>
      {d.services.length > 0 && (
        <ul className="space-y-2">
          {d.services.map((s, i) => (
            <li key={s.name} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_9rem_7rem_auto] sm:items-center">
              <span className="font-semibold">{s.name}</span>
              <Select aria-label={`How do you charge for ${s.name}?`} value={s.priceType} onChange={(e) => set({ services: d.services.map((x, j) => (j === i ? { ...x, priceType: e.target.value as Draft["services"][number]["priceType"] } : x)) })}>
                {PRICE_TYPES.map(([id, l]) => (
                  <option key={id} value={id}>
                    {l}
                  </option>
                ))}
              </Select>
              {s.priceType !== "NEGOTIABLE" ? <Input aria-label={`Price in rupees for ${s.name}`} type="number" min={0} inputMode="numeric" placeholder="₹" value={s.price} onChange={(e) => set({ services: d.services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} /> : <span />}
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => set({ services: d.services.filter((_, j) => j !== i) })}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepLocation({ d, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="District" required error={errors.district}>
          {(a) => (
            <Select {...a} value={d.district} onChange={(e) => set({ district: e.target.value })}>
              <option value="">Choose district</option>
              {DISTRICT_NAMES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Village / town (optional)" hint="Only your district is shown publicly unless you choose otherwise.">
          {(a) => <Input {...a} value={d.village} onChange={(e) => set({ village: e.target.value })} maxLength={80} />}
        </Field>
        <Field label="How far will you travel for work? (km)" error={errors.radius}>
          {(a) => <Input {...a} type="number" min={1} max={500} inputMode="numeric" value={d.radius} onChange={(e) => set({ radius: e.target.value })} className="max-w-[10rem]" />}
        </Field>
      </div>
      <Field label="Other places you work in" hint="Nearby towns or districts. Press Enter after each.">
        {(a) => <TagInput id={a.id} value={d.areas} onChange={(areas) => set({ areas })} suggestions={DISTRICT_NAMES.slice(0, 10)} max={15} />}
      </Field>
      <Notice tone="info">We never show your exact home address. People see your district (or village, if you allow it in the last step) and an approximate distance.</Notice>
    </div>
  );
}

function StepAvailability({ d, set }: StepProps) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Are you looking for work?</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {STATUSES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={d.status === s.id} onClick={() => set({ status: s.id })} className={cn("rounded-xl border p-3 text-left transition-colors", d.status === s.id ? "border-primary bg-primary/8 ring-1 ring-primary" : "hover:bg-muted")}>
              <span className="block text-sm font-bold">{s.label}</span>
              <span className="block text-xs text-muted-foreground">{s.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Days you work</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((x) => (
            <Toggle key={x} on={d.days.includes(x)} onClick={() => set({ days: toggleIn(d.days, x) })}>
              {x}
            </Toggle>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Kind of work you want</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(WORK_PREFERENCE_LABEL) as WorkPreference[]).map((x) => (
            <Toggle key={x} on={d.preferences.includes(x)} onClick={() => set({ preferences: toggleIn(d.preferences, x) })}>
              {WORK_PREFERENCE_LABEL[x]}
            </Toggle>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expected pay (optional)" hint="Shown on your profile only if you fill it in.">
          {(a) => (
            <div className="flex gap-2">
              <Input {...a} type="number" min={0} inputMode="numeric" placeholder="₹" value={d.wage} onChange={(e) => set({ wage: e.target.value })} />
              <Select aria-label="Pay unit" value={d.wageUnit} onChange={(e) => set({ wageUnit: e.target.value as Draft["wageUnit"] })} className="w-32">
                <option value="HOUR">per hour</option>
                <option value="DAY">per day</option>
                <option value="MONTH">per month</option>
                <option value="PROJECT">per project</option>
              </Select>
            </div>
          )}
        </Field>
        <Field label="Note (optional)">{(a) => <Input {...a} value={d.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} placeholder="e.g. Free after 4 pm on Sundays" />}</Field>
      </div>
    </div>
  );
}

function StepPortfolio({ d, set, mode }: StepProps) {
  if (mode === "edit")
    return (
      <p className="text-sm text-muted-foreground">
        Add or edit your work photos from the <strong>Portfolio</strong> tab of your profile.
      </p>
    );
  const p = d.portfolio;
  const patch = (x: Partial<Draft["portfolio"]>) => set({ portfolio: { ...p, ...x } });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Show one piece of work you are proud of. Photos build trust faster than words. You can skip this and add more later.</p>
      <Field label="What was the work?">{(a) => <Input {...a} value={p.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Full house re-wiring" maxLength={120} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">{(a) => <Input {...a} value={p.category} onChange={(e) => patch({ category: e.target.value })} placeholder="e.g. House wiring" maxLength={40} />}</Field>
      </div>
      <Field label="A few details">{(a) => <Textarea {...a} rows={3} value={p.description} onChange={(e) => patch({ description: e.target.value })} maxLength={800} placeholder="What did you do, and how did it turn out?" />}</Field>
      <Field label="Photo">{() => <ImagePicker value={p.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} label="Add a photo of the work" />}</Field>
    </div>
  );
}

const VIS_CHOICES: Visibility[] = ["PUBLIC", "CONNECTIONS", "PRIVATE"];
function StepVisibility({ d, set }: StepProps) {
  return (
    <div className="space-y-5">
      <Field label="Who can see your profile?">
        {(a) => (
          <Select {...a} value={d.visProfile} onChange={(e) => set({ visProfile: e.target.value as Visibility })}>
            {VIS_CHOICES.map((v) => (
              <option key={v} value={v}>
                {v === "PUBLIC" ? "Everyone (best for finding work)" : VISIBILITY_LABEL[v]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Who can see your phone number?" hint="Even when set to Connections, your phone is not shown to people you haven't accepted.">
        {(a) => (
          <Select {...a} value={d.visPhone} onChange={(e) => set({ visPhone: e.target.value as Visibility })}>
            {(["PRIVATE", "CONNECTIONS", "PUBLIC"] as Visibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABEL[v]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="How precisely do we show your location?">
        {(a) => (
          <Select {...a} value={d.precision} onChange={(e) => set({ precision: e.target.value as Draft["precision"] })}>
            <option value="DISTRICT">District only (recommended)</option>
            <option value="VILLAGE">Village / town and district</option>
          </Select>
        )}
      </Field>
      <Notice tone="info">Your exact home address is never shown. You can change all of this later in Settings → Privacy.</Notice>
    </div>
  );
}

const STEPS: { id: string; title: string; hint: string; Component: (p: StepProps) => React.ReactNode; optional?: boolean }[] = [
  { id: "profession", title: "Your profession", hint: "What work do you do?", Component: StepProfession },
  { id: "experience", title: "Experience", hint: "How long, and what you do best", Component: StepExperience },
  { id: "skills", title: "Skills", hint: "What you are good at", Component: StepSkills },
  { id: "services", title: "Services", hint: "What people can ask you for", Component: StepServices, optional: true },
  { id: "location", title: "Location", hint: "Where you work", Component: StepLocation },
  { id: "availability", title: "Availability", hint: "When and what kind of work", Component: StepAvailability },
  { id: "portfolio", title: "Portfolio", hint: "Show your best work", Component: StepPortfolio, optional: true },
  { id: "visibility", title: "Visibility", hint: "Who sees what", Component: StepVisibility },
];

// ───────────── validation & saving ─────────────
function validate(d: Draft, pro: ProfessionalProfileDTO, upTo = STEPS.length): Record<string, string> {
  const e: Record<string, string> = {};
  const has = (id: string) => STEPS.findIndex((s) => s.id === id) < upTo;
  if (has("profession") && !pro.profession.farmModules && !d.choice.professionId && !d.choice.customProfession?.trim()) e.choice = "Choose your profession, or type it under “Other”.";
  if (has("profession") && d.choice.customProfession !== undefined && !d.choice.professionId && d.choice.customProfession.trim().length < 2) e.choice = "Type your profession (at least 2 letters).";
  if (has("experience")) {
    const y = Number(d.years);
    if (d.years.trim() === "" || Number.isNaN(y) || y < 0 || y > 70) e.years = "Enter a number between 0 and 70.";
  }
  if (has("location")) {
    if (d.district.trim().length < 2) e.district = "Choose your district.";
    const r = Number(d.radius);
    if (!(r >= 1 && r <= 500)) e.radius = "Enter a distance between 1 and 500 km.";
  }
  return e;
}

function stepOfError(e: Record<string, string>) {
  if (e.choice) return 0;
  if (e.years || e.about) return 1;
  if (e.district || e.radius) return 4;
  return -1;
}

function useSave(mode: "create" | "edit", pro: ProfessionalProfileDTO) {
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  return async (d: Draft, setErrors: (e: Record<string, string>) => void) => {
    const body: Record<string, unknown> = {
      about: d.about.trim(),
      headline: d.headline.trim() || undefined,
      startedYear: Math.max(1950, THIS_YEAR - Math.round(Number(d.years))),
      languages: d.languages,
      skills: d.skills.map((s) => ({ name: s.name, level: s.level, years: s.years })),
      attributes: d.attributes,
      location: { village: d.village.trim() || undefined, district: d.district, state: d.state, serviceRadiusKm: Number(d.radius), serviceAreas: d.areas },
      availability: {
        status: d.status,
        days: d.days,
        preferences: d.preferences,
        note: d.note.trim() || undefined,
        expectedWage: d.wage.trim() && Number(d.wage) > 0 ? { amount: Number(d.wage), unit: d.wageUnit } : undefined,
      },
    };
    if (!pro.profession.farmModules) {
      if (d.choice.professionId && d.choice.professionId !== pro.profession.id) body.professionId = d.choice.professionId;
      else if (d.choice.customProfession && d.choice.customProfession.trim() && d.choice.customProfession.trim() !== pro.customProfession) body.customProfession = d.choice.customProfession.trim();
    }
    try {
      await api("PATCH", "/professionals/me", body);
      await api("PUT", "/me/privacy", { profile: d.visProfile, phone: d.visPhone, locationPrecision: d.precision });
      const failed: string[] = [];
      if (mode === "create") {
        for (const s of d.services) {
          try {
            await api("POST", "/services", { name: s.name, description: `${s.name} — offered by ${pro.user.name}. Send a request or message me for details.`, priceType: s.priceType, price: s.priceType !== "NEGOTIABLE" && s.price ? Number(s.price) : undefined, areas: [d.district, ...d.areas].slice(0, 15), availability: "" });
          } catch {
            failed.push(s.name);
          }
        }
        const p = d.portfolio;
        if (p.title.trim().length >= 2 && p.description.trim().length >= 10 && p.category.trim().length >= 2) {
          try {
            await api("POST", "/me/portfolio", { title: p.title.trim(), category: p.category.trim(), description: p.description.trim(), date: new Date().toISOString().slice(0, 10), skillsUsed: [], imageUrl: p.imageUrl });
          } catch {
            failed.push("portfolio entry");
          }
        }
      }
      await invalidate("/professionals", "/auth/me", "/profile", "/services", "/home", "/my/work", "/farmers", "/work");
      toast({ title: mode === "create" ? "Your professional profile is ready" : "Profile saved", description: failed.length ? `Couldn't add: ${failed.join(", ")}. You can add them from your profile.` : undefined });
      router.push("/profile");
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        const map: Record<string, string> = {};
        for (const [k, m] of Object.entries(e.fields)) map[k.startsWith("location.district") ? "district" : k.startsWith("location") ? "radius" : k === "startedYear" ? "years" : k] = m;
        setErrors(map);
        toast({ kind: "error", title: "Please check the highlighted fields" });
      } else if (e instanceof ApiClientError && e.code === "SENSITIVE_CONTENT") {
        toast({ kind: "error", title: "Remove sensitive details", description: e.message });
      } else toast({ kind: "error", title: "Couldn't save your profile", description: e instanceof Error ? e.message : undefined });
    }
  };
}

function useDraft(pro: ProfessionalProfileDTO) {
  const { data: me } = useMe();
  const [d, setD] = useState<Draft>(() => fromProfile(pro, emptyDraft(me ?? undefined)));
  // `me` may arrive after first render — fill only an untouched district.
  useEffect(() => {
    if (me?.district) setD((x) => (x.district ? x : { ...x, district: me.district! }));
  }, [me?.district]);
  const set: Setter = (patch) => setD((x) => ({ ...x, ...patch }));
  return [d, set] as const;
}

// ───────────── 8-step onboarding ─────────────
function Wizard({ pro }: { pro: ProfessionalProfileDTO }) {
  const [d, set] = useDraft(pro);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = useSave("create", pro);
  const last = step === STEPS.length - 1;
  const S = STEPS[step]!;

  const next = () => {
    const e = validate(d, pro, step + 1);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finish = async () => {
    const e = validate(d, pro);
    setErrors(e);
    const bad = stepOfError(e);
    if (bad >= 0) {
      setStep(bad);
      return;
    }
    setBusy(true);
    await save(d, setErrors);
    setBusy(false);
  };
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create your professional profile" subtitle="A few simple steps. You can change everything later." />
      <div className="mb-4" aria-live="polite">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-bold">
            Step {step + 1} of {STEPS.length}: {S.title}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Profile progress">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Card className="p-5 md:p-6">
        <h2 className="text-xl">{S.hint}</h2>
        <div className="mt-4">
          <S.Component d={d} set={set} pro={pro} errors={errors} mode="create" />
        </div>
      </Card>
      <div className="sticky bottom-20 z-20 mt-4 flex items-center justify-between gap-2 rounded-2xl border bg-card/95 p-3 shadow-pop backdrop-blur md:bottom-4">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {S.optional && !last && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s + 1)}>
              Skip
            </Button>
          )}
          {last ? (
            <Button type="button" size="lg" loading={busy} onClick={finish}>
              <Check className="h-4 w-4" /> Finish
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={next}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────── edit page: the same steps, all on one screen ─────────────
function Editor({ pro }: { pro: ProfessionalProfileDTO }) {
  const router = useRouter();
  const [d, set] = useDraft(pro);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = useSave("edit", pro);
  const steps = useMemo(() => STEPS.filter((s) => !(pro.profession.farmModules && s.id === "profession") && s.id !== "services" && s.id !== "portfolio"), [pro.profession.farmModules]);
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate(d, pro);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    await save(d, setErrors);
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Edit profile" subtitle="Your profile is your professional identity on KaamSetu." />
      <Card className="p-5">
        <Field label="Headline (optional)" hint="One line under your name, e.g. “Licensed electrician · Ratangarh”">{(a) => <Input {...a} value={d.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={140} />}</Field>
      </Card>
      {steps.map((s) => (
        <Card key={s.id} className="p-5" id={s.id}>
          <h2 className="text-lg">{s.title}</h2>
          <div className="mt-3">
            <s.Component d={d} set={set} pro={pro} errors={errors} mode="edit" />
          </div>
        </Card>
      ))}
      <div className="sticky bottom-20 z-20 flex justify-end gap-2 rounded-2xl border bg-card/95 p-3 shadow-pop backdrop-blur md:bottom-4">
        <Button type="button" variant="ghost" onClick={() => router.push("/profile")}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function CreateProfessionalProfile() {
  const q = useMyPro();
  const { data: me } = useMe();
  const router = useRouter();
  const noProfile = !!me && me.role !== "FARMER" && me.role !== "PROFESSIONAL" && me.role !== "EXPERT";
  useEffect(() => {
    if (noProfile) router.replace("/profile");
  }, [noProfile, router]);
  if (noProfile) return <ListSkeleton count={2} />;
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(pro) => <Wizard pro={pro} />}
    </QueryBoundary>
  );
}

export function ProfessionalEditView() {
  const q = useMyPro();
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(pro) => <Editor pro={pro} />}
    </QueryBoundary>
  );
}
