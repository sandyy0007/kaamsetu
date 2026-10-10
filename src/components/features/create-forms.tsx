"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Film, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { TagInput } from "@/components/ui/tag-input";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError, uploadFile } from "@/lib/api";
import { CROPS, FARMING_METHODS } from "@/lib/constants";
import { DISTRICT_NAMES } from "@/lib/geo";
import { communitySchema, eventSchema, listingSchema, liveScheduleSchema, machinerySchema, postSchema, reelSchema, requirementSchema, schemeSchema, type EventInput, type ListingInput, type MachineryInput, type PostInput, type ReelInput, type RequirementInput, type SchemeInput } from "@/lib/schemas";
import { EVENT_CATEGORIES, MACHINERY_TYPES, REEL_CATEGORIES, SCHEME_TOPICS } from "@/types/domain";
import type { CommunityDTO, EventDTO, ListingCardDTO, MachineryDTO, PostDTO, ReelDTO, RequirementDTO, SchemeDTO } from "@/types/dto";
import { ImagePicker } from "./image-picker";
import { ProfessionMultiPicker } from "./pro-forms";
import { VoiceButton } from "./voice-button";

const KIND_LABEL: Record<string, string> = { POST: "Update", TIP: "Tip", ANNOUNCEMENT: "Announcement", EVENT: "Event notice", STORY: "Story", MARKET: "Market update", WEATHER: "Weather alert", QUESTION: "Question to community", EXPERT_ANSWER: "Expert answer", WORK: "Work update", SKILL: "Skill tip", OPPORTUNITY: "Opportunity", TUTORIAL: "Tutorial", SERVICE: "Service offer" };
const todayStr = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function useSubmitter<T extends FieldValues, R>(f: UseFormReturn<T>, call: (v: T) => Promise<R>, opts: { prefixes: string[]; title: string; description?: string; next: (r: R) => string }) {
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  return f.handleSubmit(async (v) => {
    try {
      const r = await call(v);
      await invalidate(...opts.prefixes);
      toast({ title: opts.title, description: opts.description });
      router.push(opts.next(r));
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        for (const [k, m] of Object.entries(e.fields)) f.setError(k as never, { message: m });
        toast({ kind: "error", title: "Please fix the highlighted fields" });
      } else if (e instanceof ApiClientError && e.code === "SENSITIVE_CONTENT") {
        toast({ kind: "error", title: "Remove sensitive details", description: e.message });
      } else toast({ kind: "error", title: "Couldn't publish", description: e instanceof Error ? e.message : undefined });
    }
  });
}

function Actions({ busy, label }: { busy: boolean; label: string }) {
  return (
    <div className="flex justify-end pt-2">
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}

function DistrictInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <Input {...p} list="all-districts" />
      <datalist id="all-districts">
        {DISTRICT_NAMES.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </>
  );
}

// ───────── post ─────────
export function PostForm({ kinds }: { kinds: string[] }) {
  const sp = useSearchParams();
  const [image, setImage] = useState<string | undefined>();
  const communities = useGet<CommunityDTO[]>("/communities?joined=1");
  const f = useForm<PostInput>({ resolver: zodResolver(postSchema), defaultValues: { kind: (kinds[0] ?? "POST") as PostInput["kind"], body: "", tags: [], communityId: sp.get("community") ?? "", crop: sp.get("crop") ?? "" } });
  const submit = useSubmitter(f, (v) => api<PostDTO>("POST", "/posts", { ...v, imageUrl: image }), { prefixes: ["/feed", "/home", "/farmers", "/communities"], title: "Posted", next: () => "/home" });
  const e = f.formState.errors;
  const body = f.watch("body") ?? "";
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {kinds.length > 1 && (
        <Field label="Post type" error={e.kind?.message}>
          {(a) => (
            <Select {...a} {...f.register("kind")}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="What would you like to share?" required error={e.body?.message} hint={`${body.length}/2000 · Use #hashtags like #Mustard so others can find it`}>
        {(a) => (
          <div className="relative">
            <Textarea {...a} {...f.register("body")} rows={6} maxLength={2000} className="pr-12" placeholder="e.g. Finished a full house re-wiring today in Ratangarh. #Electrician #Churu — or a farm update, a tip, a question…" />
            <VoiceButton className="absolute right-1.5 top-1.5 h-9 w-9 min-h-0 min-w-0" label="Speak your post" onText={(t) => f.setValue("body", t, { shouldValidate: true })} />
          </div>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop (optional)" error={e.crop?.message}>
          {(a) => (
            <>
              <Input {...a} {...f.register("crop")} list="post-crops" />
              <datalist id="post-crops">
                {CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Post in a community (optional)" error={e.communityId?.message}>
          {(a) => (
            <Select {...a} {...f.register("communityId")}>
              <option value="">My followers</option>
              {communities.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Photo (optional)</p>
        <ImagePicker value={image} onChange={setImage} label="Add a photo from your farm" />
      </div>
      <Notice tone="warning">Don&apos;t post OTPs, bank, UPI, Aadhaar or card details — posts that include them are blocked. Avoid sharing your exact income.</Notice>
      <Actions busy={f.formState.isSubmitting} label="Publish post" />
    </form>
  );
}

// ───────── reel ─────────
export function ReelForm() {
  const toast = useToast();
  const [video, setVideo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const f = useForm<ReelInput>({ resolver: zodResolver(reelSchema), defaultValues: { caption: "", category: "Crop Tips", tags: [], durationSec: 30 } });
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadFile(file);
      setVideo(r.url);
      const el = document.createElement("video");
      el.preload = "metadata";
      el.src = URL.createObjectURL(file);
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration)) f.setValue("durationSec", Math.min(180, Math.max(1, Math.round(el.duration))));
        URL.revokeObjectURL(el.src);
      };
    } catch (e) {
      toast({ kind: "error", title: "Video upload failed", description: e instanceof Error ? e.message : "Use an MP4/WebM under 25 MB." });
    } finally {
      setBusy(false);
    }
  };
  const submit = useSubmitter(f, (v) => api<ReelDTO>("POST", "/reels", { ...v, videoUrl: video }), { prefixes: ["/feed", "/reels", "/home"], title: "Reel published", next: () => "/reels" });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Video (MP4 / WebM, up to 25 MB, 3 minutes)</p>
        {video ? (
          <div className="space-y-2">
            <video src={video} controls className="max-h-64 rounded-xl border" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setVideo(undefined)}>
              Remove video
            </Button>
          </div>
        ) : (
          <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}
            {busy ? "Uploading…" : "Record or choose a short video"}
            <input type="file" accept="video/mp4,video/webm" capture="environment" className="sr-only" onChange={(ev) => void pick(ev.target.files?.[0])} />
          </label>
        )}
        <p className="mt-1 text-xs text-muted-foreground">You can also publish a reel without a video — it appears as an illustrated tip card.</p>
      </div>
      <Field label="Caption" required error={e.caption?.message}>
        {(a) => <Textarea {...a} {...f.register("caption")} rows={3} maxLength={300} placeholder="e.g. 3 signs your mustard needs irrigation #Mustard" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required error={e.category?.message}>
          {(a) => (
            <Select {...a} {...f.register("category")}>
              {REEL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Duration (seconds)" error={e.durationSec?.message}>{(a) => <Input {...a} type="number" min={1} max={180} {...f.register("durationSec", { valueAsNumber: true })} />}</Field>
      </div>
      <Controller control={f.control} name="tags" render={({ field }) => <Field label="Tags">{(a) => <TagInput id={a.id} value={field.value ?? []} onChange={field.onChange} placeholder="Add tags" max={8} />}</Field>} />
      <Actions busy={f.formState.isSubmitting} label="Publish reel" />
    </form>
  );
}

// ───────── produce listing ─────────
export function ListingForm() {
  const sp = useSearchParams();
  const qty = Number(sp.get("quantity"));
  const unit = sp.get("unit");
  const f = useForm<ListingInput>({
    resolver: zodResolver(listingSchema),
    defaultValues: { crop: sp.get("crop") ?? "", variety: "", quantity: qty > 0 ? qty : (undefined as unknown as number), unit: unit === "KG" || unit === "TONNE" ? unit : "QUINTAL", expectedPrice: undefined as unknown as number, village: "", district: "", state: "Rajasthan", harvestDate: todayStr(), grade: "A", method: "Conventional", description: "" },
  });
  const submit = useSubmitter(f, (v) => api<ListingCardDTO>("POST", "/listings", v), { prefixes: ["/listings", "/farmers", "/home", "/opportunities"], title: "Produce listed", description: "Buyers looking for this crop have been notified.", next: (r) => `/market/${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop" required error={e.crop?.message}>
          {(a) => (
            <>
              <Input {...a} {...f.register("crop")} list="lst-crops" placeholder="e.g. Mustard" />
              <datalist id="lst-crops">
                {CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Variety (optional)" error={e.variety?.message}>{(a) => <Input {...a} {...f.register("variety")} />}</Field>
        <Field label="Quantity" required error={e.quantity?.message}>{(a) => <Input {...a} type="number" step="0.1" inputMode="decimal" {...f.register("quantity", { valueAsNumber: true })} />}</Field>
        <Field label="Unit" required error={e.unit?.message}>
          {(a) => (
            <Select {...a} {...f.register("unit")}>
              <option value="QUINTAL">Quintal</option>
              <option value="KG">Kg</option>
              <option value="TONNE">Tonne</option>
            </Select>
          )}
        </Field>
        <Field label="Expected price (₹ per unit)" required error={e.expectedPrice?.message} hint="Your asking price — a guide, not a fixed rate">{(a) => <Input {...a} type="number" inputMode="numeric" {...f.register("expectedPrice", { valueAsNumber: true })} />}</Field>
        <Field label="Grade" required error={e.grade?.message}>
          {(a) => (
            <Select {...a} {...f.register("grade")}>
              <option value="A">A (best)</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="Unsorted">Unsorted</option>
            </Select>
          )}
        </Field>
        <Field label="Harvest / ready date" required error={e.harvestDate?.message}>{(a) => <Input {...a} type="date" {...f.register("harvestDate")} />}</Field>
        <Field label="Farming method" required error={e.method?.message}>
          {(a) => (
            <Select {...a} {...f.register("method")}>
              {FARMING_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Village (optional)" error={e.village?.message} hint="Shown only if your privacy setting allows">{(a) => <Input {...a} {...f.register("village")} />}</Field>
        <Field label="District" required error={e.district?.message}>{(a) => <DistrictInput {...a} {...f.register("district")} />}</Field>
        <Field label="State" required error={e.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
      </div>
      <Field label="Details (optional)" error={e.description?.message} hint="Moisture, packing, pickup place… Do not write phone numbers or bank details.">{(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={600} />}</Field>
      <Notice tone="info">KaamSetu doesn&apos;t process payments. Agree price and pickup with the buyer directly, and don&apos;t accept any &quot;advance&quot; request from someone you haven&apos;t verified.</Notice>
      <Actions busy={f.formState.isSubmitting} label="List my produce" />
    </form>
  );
}

// ───────── requirement ─────────
export function RequirementForm() {
  const sp = useSearchParams();
  const f = useForm<RequirementInput>({ resolver: zodResolver(requirementSchema), defaultValues: { crop: sp.get("crop") ?? "", quantity: undefined as unknown as number, unit: "QUINTAL", district: "", state: "Rajasthan", windowStart: todayStr(), windowEnd: inDays(14), notes: "" } });
  const submit = useSubmitter(f, (v) => api<RequirementDTO>("POST", "/requirements", v), { prefixes: ["/requirements", "/buyers", "/opportunities", "/home"], title: "Requirement posted", description: "Matching farmers will see it.", next: (r) => `/market?tab=requirements&r=${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop needed" required error={e.crop?.message}>
          {(a) => (
            <>
              <Input {...a} {...f.register("crop")} list="req-crops" />
              <datalist id="req-crops">
                {CROPS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Quantity" required error={e.quantity?.message}>{(a) => <Input {...a} type="number" inputMode="decimal" {...f.register("quantity", { valueAsNumber: true })} />}</Field>
          <Field label="Unit">
            {(a) => (
              <Select {...a} {...f.register("unit")}>
                <option value="QUINTAL">Quintal</option>
                <option value="KG">Kg</option>
                <option value="TONNE">Tonne</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Delivery / pickup district" required error={e.district?.message}>{(a) => <DistrictInput {...a} {...f.register("district")} />}</Field>
        <Field label="State" required error={e.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
        <Field label="Needed from" required error={e.windowStart?.message}>{(a) => <Input {...a} type="date" {...f.register("windowStart")} />}</Field>
        <Field label="Needed by" required error={e.windowEnd?.message}>{(a) => <Input {...a} type="date" {...f.register("windowEnd")} />}</Field>
      </div>
      <Field label="Quality & terms" error={e.notes?.message} hint="e.g. moisture below 8%, pickup from farm, payment after quality check">{(a) => <Textarea {...a} {...f.register("notes")} rows={4} maxLength={600} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Post requirement" />
    </form>
  );
}

// ───────── machinery ─────────
export function MachineryForm() {
  const f = useForm<MachineryInput>({ resolver: zodResolver(machinerySchema), defaultValues: { type: "Tractor", name: "", district: "", state: "Rajasthan", rate: undefined as unknown as number, rateUnit: "HOUR", description: "" } });
  const submit = useSubmitter(f, (v) => api<MachineryDTO>("POST", "/machinery", v), { prefixes: ["/machinery", "/opportunities"], title: "Equipment listed", next: () => "/machinery" });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required error={e.type?.message}>
          {(a) => (
            <Select {...a} {...f.register("type")}>
              {MACHINERY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Equipment name" required error={e.name?.message}>{(a) => <Input {...a} {...f.register("name")} placeholder="e.g. Mahindra 575 DI tractor" />}</Field>
        <Field label="District" required error={e.district?.message}>{(a) => <DistrictInput {...a} {...f.register("district")} />}</Field>
        <Field label="State" required error={e.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
        <Field label="Rent (₹)" required error={e.rate?.message}>{(a) => <Input {...a} type="number" inputMode="numeric" {...f.register("rate", { valueAsNumber: true })} />}</Field>
        <Field label="Per" required error={e.rateUnit?.message}>
          {(a) => (
            <Select {...a} {...f.register("rateUnit")}>
              <option value="HOUR">Hour</option>
              <option value="DAY">Day</option>
              <option value="ACRE">Acre</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Details" error={e.description?.message} hint="Operator included? Fuel? Minimum hours?">{(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={400} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="List equipment" />
    </form>
  );
}

// ───────── event ─────────
export function EventForm() {
  const f = useForm<EventInput>({ resolver: zodResolver(eventSchema), defaultValues: { name: "", category: "Training", description: "", topics: [], location: "", district: "", startsAt: "", endsAt: "" } });
  const submit = useSubmitter(f, (v) => api<EventDTO>("POST", "/events", v), { prefixes: ["/events", "/home", "/opportunities"], title: "Event published", next: (r) => `/events/${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Event name" required error={e.name?.message}>{(a) => <Input {...a} {...f.register("name")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required error={e.category?.message}>
          {(a) => (
            <Select {...a} {...f.register("category")}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="District" error={e.district?.message}>{(a) => <DistrictInput {...a} {...f.register("district")} />}</Field>
        <Field label="Starts" required error={e.startsAt?.message}>{(a) => <Input {...a} type="datetime-local" {...f.register("startsAt")} />}</Field>
        <Field label="Ends" required error={e.endsAt?.message}>{(a) => <Input {...a} type="datetime-local" {...f.register("endsAt")} />}</Field>
        <Field label="Location (or “Online”)" required error={e.location?.message} className="sm:col-span-2">{(a) => <Input {...a} {...f.register("location")} />}</Field>
      </div>
      <Controller control={f.control} name="topics" render={({ field }) => <Field label="Topics">{(a) => <TagInput id={a.id} value={field.value ?? []} onChange={field.onChange} placeholder="e.g. Mustard, IPM" max={10} />}</Field>} />
      <Field label="Description" required error={e.description?.message}>{(a) => <Textarea {...a} {...f.register("description")} rows={4} maxLength={1000} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Publish event" />
    </form>
  );
}

// ───────── scheme ─────────
export function SchemeForm() {
  const f = useForm<SchemeInput>({ resolver: zodResolver(schemeSchema), defaultValues: { name: "", category: "SCHEME", topic: "Agriculture", audience: [], state: "Rajasthan", description: "", eligibility: [], benefits: [], documents: [], applicationMethod: "", officialSource: "https://", deadline: "" } });
  const [who, setWho] = useState<"AGRI" | "ALL" | "CUSTOM">("AGRI");
  const submit = useSubmitter(f, (v) => api<SchemeDTO>("POST", "/schemes", v), { prefixes: ["/schemes", "/home", "/opportunities"], title: "Scheme published", next: (r) => `/schemes/${r.id}` });
  const e = f.formState.errors;
  const list = (name: "eligibility" | "benefits" | "documents", label: string, placeholder: string) => (
    <Controller control={f.control} name={name} render={({ field, fieldState }) => <Field label={label} error={fieldState.error?.message}>{(a) => <TagInput id={a.id} value={(field.value as string[]) ?? []} onChange={field.onChange} placeholder={placeholder} max={12} />}</Field>} />
  );
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice tone="warning" title="Official information only">
        Publish only details taken from the official notification and link to it. KaamSetu never invents scheme details or eligibility.
      </Notice>
      <Field label="Scheme / notice name" required error={e.name?.message}>{(a) => <Input {...a} {...f.register("name")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" required error={e.category?.message}>
          {(a) => (
            <Select {...a} {...f.register("category")}>
              {["SCHEME", "SUBSIDY", "INSURANCE", "CREDIT", "TRAINING", "NOTIFICATION", "ALERT"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="State" required error={e.state?.message}>{(a) => <Input {...a} {...f.register("state")} />}</Field>
        <Field label="Deadline (if any)" error={e.deadline?.message}>{(a) => <Input {...a} type="date" {...f.register("deadline")} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic" required error={e.topic?.message}>
          {(a) => (
            <Select {...a} {...f.register("topic")}>
              {SCHEME_TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Who is it for?" required hint="Decides whose Opportunity Center and Government hub it appears in.">
          {(a) => (
            <Select
              {...a}
              value={who}
              onChange={(ev) => {
                const v = ev.target.value as typeof who;
                setWho(v);
                f.setValue("audience", v === "ALL" ? ["ALL"] : []);
              }}
            >
              <option value="AGRI">Farmers and agriculture</option>
              <option value="ALL">Everyone</option>
              <option value="CUSTOM">Specific professions</option>
            </Select>
          )}
        </Field>
      </div>
      {who === "CUSTOM" && (
        <Controller control={f.control} name="audience" render={({ field, fieldState }) => <Field label="Which professions?" error={fieldState.error?.message}>{() => <ProfessionMultiPicker label="Professions" value={(field.value as string[]) ?? []} onChange={field.onChange} max={10} />}</Field>} />
      )}
      <Field label="Description" required error={e.description?.message}>{(a) => <Textarea {...a} {...f.register("description")} rows={4} maxLength={1200} />}</Field>
      {list("eligibility", "Eligibility (press Enter after each point)", "e.g. Land-owning farmer")}
      {list("benefits", "Benefits", "e.g. 50% subsidy on drip systems")}
      {list("documents", "Documents needed", "e.g. Land record")}
      <Field label="How to apply" required error={e.applicationMethod?.message}>{(a) => <Textarea {...a} {...f.register("applicationMethod")} rows={2} maxLength={500} />}</Field>
      <Field label="Official source link" required error={e.officialSource?.message}>{(a) => <Input {...a} type="url" {...f.register("officialSource")} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Publish" />
    </form>
  );
}

// ───────── community ─────────
export function CommunityForm() {
  const f = useForm<z.input<typeof communitySchema>>({ resolver: zodResolver(communitySchema), defaultValues: { name: "", kind: "PROFESSION", description: "" } });
  const submit = useSubmitter(f, (v) => api<CommunityDTO>("POST", "/communities", v), { prefixes: ["/communities", "/home"], title: "Community created", next: (r) => `/communities/${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Community name" required error={e.name?.message}>{(a) => <Input {...a} {...f.register("name")} placeholder="e.g. Churu Electricians, or Hanumangarh Wheat Growers" />}</Field>
      <Field label="Type" required error={e.kind?.message}>
        {(a) => (
          <Select {...a} {...f.register("kind")}>
            <option value="PROFESSION">Profession / trade</option>
            <option value="LOCATION">Place (town or district)</option>
            <option value="CROP">Crop</option>
            <option value="METHOD">Farming method</option>
            <option value="LIVESTOCK">Livestock</option>
            <option value="MACHINERY">Machinery</option>
          </Select>
        )}
      </Field>
      <Field label="What is this community for?" required error={e.description?.message}>{(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={300} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Create community" />
    </form>
  );
}

// ───────── live ─────────
export function LiveForm() {
  const f = useForm<z.input<typeof liveScheduleSchema>>({ resolver: zodResolver(liveScheduleSchema), defaultValues: { title: "", description: "", scheduledAt: "", eventId: "" } });
  const submit = useSubmitter(f, (v) => api<{ id: string }>("POST", "/live", v), { prefixes: ["/live", "/home"], title: "Live session scheduled", next: (r) => `/live/${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice tone="info">Live streaming needs a video provider to be connected. Until then, sessions run in chat-and-Q&A mode with a clear &quot;stream not connected&quot; notice — nothing is faked.</Notice>
      <Field label="Title" required error={e.title?.message}>{(a) => <Input {...a} {...f.register("title")} />}</Field>
      <Field label="Starts at" required error={e.scheduledAt?.message}>{(a) => <Input {...a} type="datetime-local" {...f.register("scheduledAt")} />}</Field>
      <Field label="Description" required error={e.description?.message}>{(a) => <Textarea {...a} {...f.register("description")} rows={3} maxLength={600} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Schedule session" />
    </form>
  );
}

// ───────── course ─────────
const courseForm = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120),
  category: z.string().trim().min(2, "Category is required").max(40),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  description: z.string().trim().min(10, "Describe the course in a sentence or two").max(600),
  lessonTitle: z.string().trim().min(3, "Lesson title is required").max(120),
  lessonBody: z.string().trim().min(20, "Write at least a short lesson").max(4000),
});
export function CourseForm() {
  const f = useForm<z.infer<typeof courseForm>>({ resolver: zodResolver(courseForm), defaultValues: { title: "", category: "", level: "Beginner", description: "", lessonTitle: "", lessonBody: "" } });
  const submit = useSubmitter(f, (v) => api<{ id: string }>("POST", "/courses", v), { prefixes: ["/courses", "/home"], title: "Course created", description: "You can add more lessons from the course page.", next: (r) => `/learning/${r.id}` });
  const e = f.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Course title" required error={e.title?.message}>{(a) => <Input {...a} {...f.register("title")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Crop / topic" required error={e.category?.message}>{(a) => <Input {...a} {...f.register("category")} placeholder="e.g. Mustard" />}</Field>
        <Field label="Level" required error={e.level?.message}>
          {(a) => (
            <Select {...a} {...f.register("level")}>
              {["Beginner", "Intermediate", "Advanced"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Short description" required error={e.description?.message}>{(a) => <Textarea {...a} {...f.register("description")} rows={2} maxLength={600} />}</Field>
      <Field label="First lesson title" required error={e.lessonTitle?.message}>{(a) => <Input {...a} {...f.register("lessonTitle")} />}</Field>
      <Field label="First lesson content" required error={e.lessonBody?.message}>{(a) => <Textarea {...a} {...f.register("lessonBody")} rows={6} maxLength={4000} />}</Field>
      <Actions busy={f.formState.isSubmitting} label="Create course" />
    </form>
  );
}
