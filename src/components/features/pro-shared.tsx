"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Briefcase, CalendarDays, Clock, Hammer, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { DISTRICT_NAMES } from "@/lib/geo";
import { profileHref } from "@/lib/links";
import { cn, formatShortDate, pluralize } from "@/lib/utils";
import type { AvailabilityStatus } from "@/types/domain";
import type { CatalogDTO, ProfessionalCardDTO, ProfessionDTO, ServiceDTO, WorkOpportunityDTO } from "@/types/dto";
import { FollowButton, MessageButton, SaveButton } from "./actions";
import { UserLine } from "./people";

// ───────────── labels ─────────────
export const WORK_KIND_LABEL: Record<string, string> = {
  JOB: "Job",
  DAILY: "Daily work",
  CONTRACT: "Contract",
  SEASONAL: "Seasonal",
  FREELANCE: "Freelance",
  SERVICE_REQUEST: "Service request",
  APPRENTICESHIP: "Apprenticeship",
  TRAINING: "Training",
};
export const PAY_UNIT_LABEL: Record<string, string> = { HOUR: "per hour", DAY: "per day", MONTH: "per month", PROJECT: "per project", NEGOTIABLE: "To be discussed" };
export const WORK_PREFERENCE_LABEL: Record<string, string> = { DAILY: "Daily work", CONTRACT: "Contract", SEASONAL: "Seasonal", PERMANENT: "Permanent", FREELANCE: "Freelance" };
export const AVAILABILITY_TONE: Record<AvailabilityStatus, "success" | "info" | "warning" | "neutral"> = { AVAILABLE: "success", OPEN_TO_WORK: "info", BUSY: "warning", NOT_AVAILABLE: "neutral" };
export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ───────────── catalog ─────────────
/** The profession / skill catalog (server-managed; nothing about a profession is hardcoded in components). */
export function useCatalog() {
  const q = useGet<CatalogDTO>("/catalog", { staleTime: 5 * 60_000 });
  const professions: ProfessionDTO[] = q.data?.categories.flatMap((c) => c.professions) ?? [];
  const byId = (id?: string) => professions.find((p) => p.id === id);
  return { ...q, professions, byId };
}

// ───────────── small pieces ─────────────
export function AvailabilityBadge({ status, label }: { status: AvailabilityStatus; label: string }) {
  return (
    <Badge tone={AVAILABILITY_TONE[status]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> {label}
    </Badge>
  );
}

/** Only verifiable facts — never a star rating or an invented score. */
export function ReputationFacts({ r, className }: { r: { completedJobs?: number; recommendations?: number; verifiedSkills?: number; responseRate?: number | null; certifications?: number }; className?: string }) {
  const facts = [
    r.completedJobs ? `${pluralize(r.completedJobs, "job")} completed` : null,
    r.recommendations ? pluralize(r.recommendations, "recommendation") : null,
    r.verifiedSkills ? `${pluralize(r.verifiedSkills, "verified skill")}` : null,
    r.certifications ? pluralize(r.certifications, "certification") : null,
    r.responseRate != null ? `${Math.round(r.responseRate * 100)}% replied` : null,
  ].filter(Boolean) as string[];
  if (!facts.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground", className)} aria-label="Track record">
      {facts.map((f) => (
        <li key={f} className="inline-flex items-center gap-1">
          <BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden /> {f}
        </li>
      ))}
    </ul>
  );
}

export function Chips({ items, max = 5, tone = "neutral" }: { items: string[]; max?: number; tone?: "neutral" | "primary" | "accent" | "success" | "info" }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((s) => (
        <li key={s}>
          <Badge tone={tone}>{s}</Badge>
        </li>
      ))}
      {items.length > max && (
        <li>
          <Badge tone="outline">+{items.length - max}</Badge>
        </li>
      )}
    </ul>
  );
}

// ───────────── request a service ─────────────
const requestForm = z.object({
  serviceId: z.string().min(1, "Choose a service"),
  date: z.string().min(1, "Choose a date"),
  village: z.string().trim().max(80).optional(),
  district: z.string().min(2, "Choose your district"),
  description: z.string().trim().min(10, "Describe the work in a few words").max(600),
});

export function RequestServiceSheet({ open, onClose, providerName, services, defaultServiceId }: { open: boolean; onClose: () => void; providerName: string; services: { id: string; name: string; priceLabel: string }[]; defaultServiceId?: string }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const { data: me } = useMe();
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, formState, setError, reset } = useForm<z.infer<typeof requestForm>>({
    resolver: zodResolver(requestForm),
    defaultValues: { serviceId: defaultServiceId ?? services[0]?.id ?? "", date: "", village: "", district: me?.district ?? "", description: "" },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await api("POST", "/service-requests", { ...v, village: v.village || undefined, state: "Rajasthan" });
      void invalidate("/service-requests", "/my/work", "/professionals");
      toast({ title: "Request sent", description: `${providerName} will be notified and can accept or decline. You can then talk in Messages.` });
      reset();
      onClose();
    } catch (e) {
      setError("description", { message: e instanceof ApiClientError ? e.message : "Couldn't send the request" });
    }
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Request a service from ${providerName}`}
      description="Choose the service, date and place. No payment happens in KaamSetu."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            Send request
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Notice tone="warning">Agree the rate and timing in Messages once they accept. Never share OTP, bank or UPI details, and don&apos;t pay an advance to someone you haven&apos;t met.</Notice>
        <Field label="Service" required error={formState.errors.serviceId?.message}>
          {(a) => (
            <Select {...a} {...register("serviceId")}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.priceLabel}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred date" required error={formState.errors.date?.message}>
            {(a) => <Input type="date" min={today} {...a} {...register("date")} />}
          </Field>
          <Field label="District" required error={formState.errors.district?.message}>
            {(a) => (
              <Select {...a} {...register("district")}>
                <option value="">Choose district</option>
                {DISTRICT_NAMES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Village / area (optional)" hint="Only the professional sees this after they accept. Never enter a full home address here." error={formState.errors.village?.message}>
          {(a) => <Input {...a} {...register("village")} placeholder="e.g. Ward 5, Rajaldesar" />}
        </Field>
        <Field label="What do you need done?" required error={formState.errors.description?.message}>
          {(a) => <Textarea {...a} {...register("description")} rows={4} placeholder="Describe the work, size of the job and any timing needs." />}
        </Field>
      </form>
    </Sheet>
  );
}

/** Button + sheet; hides itself when the professional has no active services. */
export function RequestServiceButton({ providerName, services, size = "sm", className }: { providerName: string; services: { id: string; name: string; priceLabel: string }[]; size?: "sm" | "md"; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!services.length) return null;
  return (
    <>
      <Button size={size} variant="accent" className={className} onClick={() => setOpen(true)}>
        <Hammer className="h-4 w-4" aria-hidden /> Request service
      </Button>
      {open && <RequestServiceSheet open={open} onClose={() => setOpen(false)} providerName={providerName} services={services} />}
    </>
  );
}

// ───────────── Professional card (one reusable card for every profession) ─────────────
export function ProfessionalCard({ p }: { p: ProfessionalCardDTO }) {
  const label = p.customProfession && p.profession.id === "pr_other" ? p.customProfession : p.profession.name;
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <UserLine user={p.user} sub={`${p.profession.emoji} ${label}`} />
        {!p.isSelf && <FollowButton userId={p.user.id} following={p.isFollowing ?? false} />}
      </div>
      {p.matchReason && <p className="mt-3 rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary">{p.matchReason}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden />
          {p.district}
          {p.distanceKm != null && p.distanceKm > 0 && ` · ~${Math.round(p.distanceKm)} km`}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="h-4 w-4" aria-hidden />
          {p.experienceYears} yrs
        </span>
        <AvailabilityBadge status={p.availability.status} label={p.availability.label} />
      </p>
      {p.farmer ? (
        <div className="mt-3 space-y-2">
          <Chips items={p.farmer.crops} tone="primary" />
          {p.farmer.produce.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">For sale: </span>
              {p.farmer.produce.map((x) => `${x.crop} ${x.quantity} ${x.unit.toLowerCase()}`).join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3">
            <Chips items={p.skills} tone="neutral" max={4} />
          </div>
          {p.services.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-sm">
              {p.services.slice(0, 2).map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="truncate font-semibold">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">{s.priceLabel}</span>
                </li>
              ))}
              {p.services.length > 2 && <li className="text-xs text-muted-foreground">+{p.services.length - 2} more services</li>}
            </ul>
          )}
        </>
      )}
      <ReputationFacts r={{ ...p.reputation }} className="mt-3" />
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link
          href={profileHref(p.user, "ProfessionalCard:ViewProfile")}
          onClick={() => {
            console.log("[KaamSetu:Click:ProfessionalCard]", {
              userId: p.user.id,
              name: p.user.name,
              role: p.user.role,
              href: profileHref(p.user, "ProfessionalCard:ViewProfile"),
            });
          }}
          className="tap inline-flex flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted"
        >
          View profile
        </Link>
        {!p.isSelf && <RequestServiceButton providerName={p.user.name} services={p.services} />}
        {!p.isSelf && <MessageButton userId={p.user.id} name={p.user.name} context={{ kind: "DIRECT", title: `Message to ${p.user.name}` }} />}
      </div>
    </Card>
  );
}

// ───────────── Service card ─────────────
export function ServiceCard({ s, onEdit }: { s: ServiceDTO; onEdit?: (s: ServiceDTO) => void }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base">{s.name}</h3>
          <p className="text-sm font-bold text-primary">{s.priceLabel}</p>
        </div>
        {s.isDemo && <DemoBadge />}
      </div>
      <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
      {s.areas.length > 0 && (
        <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {s.areas.slice(0, 4).join(", ")}
          {s.distanceKm != null && s.distanceKm > 0 && ` · ~${Math.round(s.distanceKm)} km`}
        </p>
      )}
      {s.availability && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {s.availability}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <UserLine user={s.owner} size="sm" className="flex-1" />
        {onEdit && s.isOwn ? (
          <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
            Edit
          </Button>
        ) : (
          !s.isOwn && <RequestServiceButton providerName={s.owner.name} services={[{ id: s.id, name: s.name, priceLabel: s.priceLabel }]} />
        )}
      </div>
    </Card>
  );
}

// ───────────── apply to a work opportunity ─────────────
export function ApplySheet({ w, open, onClose }: { w: WorkOpportunityDTO; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const { register, handleSubmit, formState, setError } = useForm<{ note: string }>({ defaultValues: { note: "" } });
  const submit = handleSubmit(async (v) => {
    try {
      await api("POST", `/work/${w.id}/apply`, { note: v.note });
      void invalidate("/work", "/my/work", "/opportunities");
      toast({ title: "Application sent", description: `${w.poster.name} will see it and can reply in Messages.` });
      onClose();
    } catch (e) {
      setError("note", { message: e instanceof ApiClientError ? e.message : "Couldn't send your application" });
    }
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Apply for this work"
      description={w.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            Send application
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Notice tone="warning">Never pay anyone to get work. Don&apos;t share OTP, Aadhaar, bank or UPI details in your note.</Notice>
        <p className="text-sm text-muted-foreground">Your profile (profession, skills, experience and availability) is shared with {w.poster.name}. Your phone number stays private.</p>
        <Field label="A short note (optional)" error={formState.errors.note?.message} hint="For example: when you can start, tools you have, similar work you did.">
          {(a) => <Textarea {...a} {...register("note")} rows={4} />}
        </Field>
      </form>
    </Sheet>
  );
}

// ───────────── Work card ─────────────
export function WorkCard({ w, onChanged }: { w: WorkOpportunityDTO; onChanged?: () => void }) {
  const [apply, setApply] = useState(false);
  const toast = useToast();
  const invalidate = useInvalidate();
  const withdraw = async () => {
    try {
      await api("DELETE", `/work/${w.id}/apply`);
      void invalidate("/work", "/my/work", "/opportunities");
      toast({ title: "Application withdrawn" });
      onChanged?.();
    } catch (e) {
      toast({ kind: "error", title: "Couldn't withdraw", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <Card className="relative flex flex-col p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="primary">{WORK_KIND_LABEL[w.kind] ?? w.kind}</Badge>
        {w.professions.slice(0, 2).map((p) => (
          <Badge key={p.id} tone="neutral">
            {p.emoji} {p.name}
          </Badge>
        ))}
        {w.status !== "OPEN" && <Badge tone="warning">{w.status === "FILLED" ? "Filled" : "Closed"}</Badge>}
        {w.isDemo && <DemoBadge />}
      </div>
      <h3 className="mt-2 text-base">
        <Link href={`/opportunities/${w.id}`} className="hover:underline">
          {w.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden />
          {w.district}
          {w.distanceKm != null && w.distanceKm > 0 && ` · ~${Math.round(w.distanceKm)} km`}
        </span>
        {w.startDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {formatShortDate(w.startDate)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4" aria-hidden />
          {pluralize(w.openings, "person", "people")}
        </span>
      </p>
      <p className="mt-1 text-sm font-bold">{w.payLabel}</p>
      {w.viewer.matchReasons.length > 0 && <p className="mt-2 rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary">{w.viewer.matchReasons.join(" · ")}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <UserLine user={w.poster} sub={w.business?.name} size="sm" className="flex-1" />
        <SaveButton targetType="WORK" targetId={w.id} saved={w.viewer.saved} className="rounded-xl border" />
        <Link href={`/opportunities/${w.id}`} className="tap inline-flex items-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
          View
        </Link>
        {w.viewer.isOwn ? (
          <Badge tone="info">Your listing{w.applicantCount != null ? ` · ${pluralize(w.applicantCount, "applicant")}` : ""}</Badge>
        ) : w.viewer.applied ? (
          <>
            <Badge tone={w.viewer.applicationStatus === "ACCEPTED" ? "success" : w.viewer.applicationStatus === "REJECTED" ? "danger" : "info"}>{(w.viewer.applicationStatus ?? "APPLIED").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Badge>
            {w.viewer.applicationStatus === "APPLIED" && (
              <Button size="sm" variant="ghost" onClick={withdraw}>
                Withdraw
              </Button>
            )}
          </>
        ) : (
          w.viewer.canApply && (
            <Button size="sm" onClick={() => setApply(true)}>
              Apply
            </Button>
          )
        )}
      </div>
      {apply && <ApplySheet w={w} open={apply} onClose={() => setApply(false)} />}
    </Card>
  );
}
