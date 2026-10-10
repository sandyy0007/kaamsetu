"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm, type Control, type FieldValues, type Path } from "react-hook-form";
import { z } from "zod";
import { SCENE_KINDS } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { QueryBoundary } from "@/components/ui/state";
import { TagInput } from "@/components/ui/tag-input";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import { CROPS, FARMING_METHODS, LANGUAGE_OPTIONS } from "@/lib/constants";
import { DISTRICT_NAMES } from "@/lib/geo";
import { buyerProfileSchema, expertProfileSchema, farmerProfileSchema, identitySchema, organizationProfileSchema } from "@/lib/schemas";
import { useMe } from "@/hooks/use-me";
import type { BuyerProfileDTO, ExpertProfileDTO, FarmerProfileDTO, OrgProfileDTO } from "@/types/dto";
import { ProfessionalEditView } from "./profile-wizard";

type ProfileMe = { role: string; farmer?: FarmerProfileDTO; buyer?: BuyerProfileDTO; expert?: ExpertProfileDTO; org?: OrgProfileDTO };

const idBase = identitySchema.pick({ name: true, headline: true });
const farmerSchema = idBase.merge(farmerProfileSchema);
const buyerSchema = idBase.merge(buyerProfileSchema);
const expertSchema = idBase.merge(expertProfileSchema);
const orgSchema = idBase.merge(organizationProfileSchema.omit({ name: true }));

type FarmerForm = z.input<typeof farmerSchema>;
const uid = () => `n-${Math.random().toString(36).slice(2, 9)}`;

function Tags<T extends FieldValues>({ control, name, label, hint, placeholder, suggestions, max }: { control: Control<T>; name: Path<T>; label: string; hint?: string; placeholder?: string; suggestions?: readonly string[]; max?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={fieldState.error?.message ?? (Array.isArray(fieldState.error) ? "Check these entries" : undefined)}>
          {(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder={placeholder} suggestions={suggestions} max={max} invalid={!!fieldState.error} />}
        </Field>
      )}
    />
  );
}

function FormSection({ title, children, id, description }: { title: string; children: React.ReactNode; id?: string; description?: string }) {
  return (
    <Card className="p-5" id={id}>
      <h2 className="text-lg">{title}</h2>
      {description && <p className="mb-3 mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </Card>
  );
}

function SaveBar({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="sticky bottom-20 z-20 flex justify-end gap-2 rounded-2xl border bg-card/95 p-3 shadow-pop backdrop-blur md:bottom-4">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" loading={busy}>
        Save profile
      </Button>
    </div>
  );
}

function useSaver(path: string, extra: (v: Record<string, unknown>) => Record<string, unknown>) {
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  return async (values: Record<string, unknown>, setError: (k: never, e: { message: string }) => void) => {
    const { name, headline, ...rest } = values as { name: string; headline?: string };
    try {
      await api("PATCH", "/me", { name, headline });
      await api("PATCH", path, extra(rest));
      await invalidate("/farmers", "/buyers", "/experts", "/orgs", "/profile", "/auth/me");
      toast({ title: "Profile saved" });
      router.push("/profile");
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as never, { message: m });
      else toast({ kind: "error", title: "Couldn't save your profile", description: e instanceof Error ? e.message : undefined });
    }
  };
}

function FarmerEdit({ p }: { p: FarmerProfileDTO }) {
  const router = useRouter();
  const save = useSaver("/profile/farmer", (v) => v);
  const f = useForm<FarmerForm>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: p.user.name,
      headline: p.user.headline ?? "",
      village: p.village ?? "",
      district: p.district,
      state: p.state,
      farmingSince: p.farmingSince,
      languages: p.languages,
      specialization: p.specialization,
      methods: p.methods,
      livestock: p.livestock,
      story: p.story,
      skills: p.skills,
      interests: p.interests,
      certifications: p.certifications,
      achievements: p.achievements,
      portfolio: p.portfolio,
    },
  });
  const certs = useFieldArray({ control: f.control, name: "certifications" });
  const ach = useFieldArray({ control: f.control, name: "achievements" });
  const port = useFieldArray({ control: f.control, name: "portfolio" });
  const err = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => save(v as Record<string, unknown>, f.setError as never))} noValidate className="space-y-4">
      <FormSection title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={err.name?.message}>
            {(a) => <Input {...a} {...f.register("name")} autoComplete="name" />}
          </Field>
          <Field label="Headline" hint="e.g. Mustard & wheat grower · Churu" error={err.headline?.message}>
            {(a) => <Input {...a} {...f.register("headline")} maxLength={140} />}
          </Field>
        </div>
      </FormSection>
      <FormSection title="Location & farming">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Village" required error={err.village?.message}>
            {(a) => <Input {...a} {...f.register("village")} />}
          </Field>
          <Field label="District" required error={err.district?.message}>
            {(a) => (
              <>
                <Input {...a} {...f.register("district")} list="districts" />
                <datalist id="districts">
                  {DISTRICT_NAMES.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="State" required error={err.state?.message}>
            {(a) => <Input {...a} {...f.register("state")} />}
          </Field>
          <Field label="Farming since (year)" required error={err.farmingSince?.message}>
            {(a) => <Input {...a} type="number" inputMode="numeric" {...f.register("farmingSince", { valueAsNumber: true })} />}
          </Field>
          <Field label="Specialisation" required className="sm:col-span-2" error={err.specialization?.message}>
            {(a) => <Input {...a} {...f.register("specialization")} placeholder="e.g. Mustard, wheat and bajra · drip irrigation" />}
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Tags control={f.control} name="methods" label="Farming methods" suggestions={FARMING_METHODS} />
          <Tags control={f.control} name="languages" label="Languages you speak" suggestions={LANGUAGE_OPTIONS} />
          <Tags control={f.control} name="livestock" label="Livestock (if any)" placeholder="e.g. Cow, Buffalo" />
          <Tags control={f.control} name="interests" label="Interests" placeholder="e.g. Drip irrigation" />
        </div>
      </FormSection>
      <FormSection title="Your farming story" description="A few honest lines about your farm and what you are proud of.">
        <Field label="Story" error={err.story?.message}>
          {(a) => <Textarea {...a} {...f.register("story")} rows={5} maxLength={1200} />}
        </Field>
        <div className="mt-4">
          <Tags control={f.control} name="skills" label="Skills & expertise" suggestions={["Drip irrigation", "Organic farming", "Seed selection", "IPM", "Soil testing", "Dairy management", "Direct marketing"]} />
        </div>
      </FormSection>
      <FormSection title="Certifications" id="certs">
        <ul className="space-y-3">
          {certs.fields.map((c, i) => (
            <li key={c.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_6rem_auto]">
              <Field label="Title" error={err.certifications?.[i]?.title?.message}>
                {(a) => <Input {...a} {...f.register(`certifications.${i}.title`)} />}
              </Field>
              <Field label="Issued by" error={err.certifications?.[i]?.issuer?.message}>
                {(a) => <Input {...a} {...f.register(`certifications.${i}.issuer`)} />}
              </Field>
              <Field label="Year" error={err.certifications?.[i]?.year?.message}>
                {(a) => <Input {...a} type="number" {...f.register(`certifications.${i}.year`, { valueAsNumber: true })} />}
              </Field>
              <Button type="button" variant="ghost" size="icon" className="self-end text-danger" aria-label="Remove certification" onClick={() => certs.remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => certs.append({ id: uid(), title: "", issuer: "", year: new Date().getFullYear() })}>
          <Plus className="h-4 w-4" /> Add certification
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Listing a certification does not make it &quot;verified&quot;. Verified badges are granted by KaamSetu admins only.</p>
      </FormSection>
      <FormSection title="Achievements">
        <ul className="space-y-3">
          {ach.fields.map((c, i) => (
            <li key={c.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_6rem_auto]">
              <Field label="Title" error={err.achievements?.[i]?.title?.message}>
                {(a) => <Input {...a} {...f.register(`achievements.${i}.title`)} />}
              </Field>
              <Field label="Year" error={err.achievements?.[i]?.year?.message}>
                {(a) => <Input {...a} type="number" {...f.register(`achievements.${i}.year`, { valueAsNumber: true })} />}
              </Field>
              <Button type="button" variant="ghost" size="icon" className="self-end text-danger" aria-label="Remove achievement" onClick={() => ach.remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Field label="Description" className="sm:col-span-3" error={err.achievements?.[i]?.description?.message}>
                {(a) => <Input {...a} {...f.register(`achievements.${i}.description`)} />}
              </Field>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => ach.append({ id: uid(), title: "", year: new Date().getFullYear(), description: "" })}>
          <Plus className="h-4 w-4" /> Add achievement
        </Button>
      </FormSection>
      <FormSection title="Portfolio" id="portfolio" description="Highlight seasons you are proud of — crop, area, yield and method. Don't include income or private finance.">
        <ul className="space-y-3">
          {port.fields.map((c, i) => (
            <li key={c.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
              <Field label="Title" error={err.portfolio?.[i]?.title?.message} className="sm:col-span-2">
                {(a) => <Input {...a} {...f.register(`portfolio.${i}.title`)} />}
              </Field>
              <Field label="Crop" error={err.portfolio?.[i]?.crop?.message}>
                {(a) => <Input {...a} list="crops-dl" {...f.register(`portfolio.${i}.crop`)} />}
              </Field>
              <Field label="Year" error={err.portfolio?.[i]?.year?.message}>
                {(a) => <Input {...a} type="number" {...f.register(`portfolio.${i}.year`, { valueAsNumber: true })} />}
              </Field>
              <Field label="Area (acres)" error={err.portfolio?.[i]?.areaAcres?.message}>
                {(a) => <Input {...a} type="number" step="0.1" {...f.register(`portfolio.${i}.areaAcres`, { valueAsNumber: true })} />}
              </Field>
              <Field label="Yield" error={err.portfolio?.[i]?.yieldText?.message}>
                {(a) => <Input {...a} placeholder="e.g. 8 quintal/acre" {...f.register(`portfolio.${i}.yieldText`)} />}
              </Field>
              <Field label="Method" error={err.portfolio?.[i]?.method?.message}>
                {(a) => <Input {...a} {...f.register(`portfolio.${i}.method`)} />}
              </Field>
              <Field label="Picture style">
                {(a) => (
                  <Select {...a} {...f.register(`portfolio.${i}.scene`)}>
                    {SCENE_KINDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Description" className="sm:col-span-2" error={err.portfolio?.[i]?.description?.message}>
                {(a) => <Textarea {...a} rows={2} {...f.register(`portfolio.${i}.description`)} />}
              </Field>
              <div className="sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => port.remove(i)}>
                  <Trash2 className="h-4 w-4" /> Remove item
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <datalist id="crops-dl">
          {CROPS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => port.append({ id: uid(), title: "", year: new Date().getFullYear(), crop: "", areaAcres: 1, yieldText: "", method: "Conventional", description: "", scene: "wheat" })}>
          <Plus className="h-4 w-4" /> Add portfolio item
        </Button>
      </FormSection>
      <SaveBar busy={f.formState.isSubmitting} onCancel={() => router.back()} />
    </form>
  );
}

function BuyerEdit({ p }: { p: BuyerProfileDTO }) {
  const router = useRouter();
  const save = useSaver("/profile/buyer", (v) => v);
  type F = z.input<typeof buyerSchema>;
  const f = useForm<F>({ resolver: zodResolver(buyerSchema), defaultValues: { name: p.user.name, headline: p.user.headline ?? "", businessName: p.businessName, industry: p.industry, district: p.district, state: p.state, about: p.about, cropsPurchased: p.cropsPurchased, website: p.website ?? "" } });
  const err = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => save(v as Record<string, unknown>, f.setError as never))} noValidate className="space-y-4">
      <FormSection title="Your details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" required error={err.name?.message}>{(a) => <Input {...a} {...f.register("name")} />}</Field>
          <Field label="Headline" error={err.headline?.message}>{(a) => <Input {...a} {...f.register("headline")} />}</Field>
          <Field label="Business name" required error={err.businessName?.message}>{(a) => <Input {...a} {...f.register("businessName")} />}</Field>
          <Field label="Industry" required error={err.industry?.message}>{(a) => <Input {...a} {...f.register("industry")} placeholder="e.g. Oil mill, Exporter, Trader" />}</Field>
          <Field label="District" required error={err.district?.message}>{(a) => <Input {...a} {...f.register("district")} />}</Field>
          <Field label="State" required error={err.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
          <Field label="Website" error={err.website?.message} className="sm:col-span-2">{(a) => <Input {...a} {...f.register("website")} placeholder="https://" />}</Field>
        </div>
      </FormSection>
      <FormSection title="What you buy">
        <Tags control={f.control} name="cropsPurchased" label="Crops purchased" suggestions={CROPS} />
        <Field label="About your business" required className="mt-4" error={err.about?.message}>{(a) => <Textarea {...a} {...f.register("about")} rows={4} />}</Field>
      </FormSection>
      <SaveBar busy={f.formState.isSubmitting} onCancel={() => router.back()} />
    </form>
  );
}

function ExpertEdit({ p }: { p: ExpertProfileDTO }) {
  const router = useRouter();
  const save = useSaver("/profile/expert", (v) => v);
  type F = z.input<typeof expertSchema>;
  const f = useForm<F>({ resolver: zodResolver(expertSchema), defaultValues: { name: p.user.name, headline: p.user.headline ?? "", category: p.category, qualification: p.qualification, organization: p.organization, specialization: p.specialization, experienceYears: p.experienceYears, district: p.district, state: p.state, about: p.about } });
  const err = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => save(v as Record<string, unknown>, f.setError as never))} noValidate className="space-y-4">
      <FormSection title="Your details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={err.name?.message}>{(a) => <Input {...a} {...f.register("name")} />}</Field>
          <Field label="Headline" error={err.headline?.message}>{(a) => <Input {...a} {...f.register("headline")} />}</Field>
          <Field label="Expert type" required error={err.category?.message}>
            {(a) => (
              <Select {...a} {...f.register("category")}>
                {["Agronomist", "Veterinarian", "Soil Expert", "Researcher", "KVK Expert"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Qualification" required error={err.qualification?.message}>{(a) => <Input {...a} {...f.register("qualification")} />}</Field>
          <Field label="Organisation" required error={err.organization?.message}>{(a) => <Input {...a} {...f.register("organization")} />}</Field>
          <Field label="Experience (years)" required error={err.experienceYears?.message}>{(a) => <Input {...a} type="number" {...f.register("experienceYears", { valueAsNumber: true })} />}</Field>
          <Field label="District" required error={err.district?.message}>{(a) => <Input {...a} {...f.register("district")} />}</Field>
          <Field label="State" required error={err.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
        </div>
      </FormSection>
      <FormSection title="Expertise">
        <Tags control={f.control} name="specialization" label="Specialisations" suggestions={["Mustard", "Wheat", "Bajra", "Soil health", "IPM", "Dairy", "Drip irrigation"]} />
        <Field label="About" required className="mt-4" error={err.about?.message}>{(a) => <Textarea {...a} {...f.register("about")} rows={4} />}</Field>
        <p className="mt-2 text-xs text-muted-foreground">The &quot;Verified Expert&quot; badge is granted only after KaamSetu admins review your credentials.</p>
      </FormSection>
      <SaveBar busy={f.formState.isSubmitting} onCancel={() => router.back()} />
    </form>
  );
}

function OrgEdit({ p }: { p: OrgProfileDTO }) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  type F = z.input<typeof orgSchema> & { orgName: string };
  const f = useForm<F>({ resolver: zodResolver(orgSchema.extend({ orgName: z.string().trim().min(2, "Name is required").max(120) })), defaultValues: { name: p.user.name, headline: p.user.headline ?? "", orgName: p.name, about: p.about, website: p.website ?? "", district: p.district ?? "" } });
  const err = f.formState.errors;
  const submit = f.handleSubmit(async (v) => {
    try {
      await api("PATCH", "/me", { name: v.name, headline: v.headline });
      await api("PATCH", "/profile/org", { name: v.orgName, about: v.about, website: v.website, district: v.district });
      await invalidate("/orgs", "/profile", "/auth/me");
      toast({ title: "Profile saved" });
      router.push("/profile");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't save", description: e instanceof Error ? e.message : undefined });
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormSection title="Organisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account name" required error={err.name?.message}>{(a) => <Input {...a} {...f.register("name")} />}</Field>
          <Field label="Headline" error={err.headline?.message}>{(a) => <Input {...a} {...f.register("headline")} />}</Field>
          <Field label="Organisation name" required error={err.orgName?.message}>{(a) => <Input {...a} {...f.register("orgName")} />}</Field>
          <Field label="District" error={err.district?.message}>{(a) => <Input {...a} {...f.register("district")} />}</Field>
          <Field label="Website" className="sm:col-span-2" error={err.website?.message}>{(a) => <Input {...a} {...f.register("website")} placeholder="https://" />}</Field>
          <Field label="About" required className="sm:col-span-2" error={err.about?.message}>{(a) => <Textarea {...a} {...f.register("about")} rows={4} />}</Field>
        </div>
      </FormSection>
      <SaveBar busy={f.formState.isSubmitting} onCancel={() => router.back()} />
    </form>
  );
}

function LegacyProfileEdit() {
  const sp = useSearchParams();
  const q = useGet<ProfileMe>("/profile/me", { staleTime: 0 });
  const welcome = sp.get("welcome") === "1";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={welcome ? "Welcome! Set up your profile" : "Edit profile"} subtitle={welcome ? "Add a few details so customers, employers and other professionals can find and trust you. You can skip and finish later." : "Your profile is your professional identity on KaamSetu."} />
      <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
        {(d) => (d.farmer ? <FarmerEdit p={d.farmer} /> : d.buyer ? <BuyerEdit p={d.buyer} /> : d.expert ? <ExpertEdit p={d.expert} /> : d.org ? <OrgEdit p={d.org} /> : <p>This account type has no editable profile.</p>)}
      </QueryBoundary>
    </div>
  );
}

/** Professionals edit the universal profile; farmers, buyers, experts and organisations keep their existing forms. */
export function ProfileEditView() {
  const { data: me } = useMe();
  if (!me) return <ListSkeleton count={3} />;
  return me.role === "PROFESSIONAL" ? <ProfessionalEditView /> : <LegacyProfileEdit />;
}
