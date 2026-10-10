"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Briefcase, CalendarDays, Clock, GraduationCap, Landmark, Leaf, MapPin, Package, Radio, Tractor, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { useGet } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import { sceneForCrop } from "@/lib/crop-scene";
import { unitLabel, cn, daysUntil, formatDate, formatINR, formatShortDate, formatTime, pluralize, timeAgo } from "@/lib/utils";
import type { CommunityDTO, CourseCardDTO, EventDTO, ListingCardDTO, MachineryDTO, OpportunityDTO, Page, QuestionDTO, RequirementDTO, SchemeDTO } from "@/types/dto";
import { SaveButton } from "./actions";
import { UserLine } from "./people";

export function ListingCard({ l }: { l: ListingCardDTO }) {
  return (
    <Card className="group relative flex flex-col overflow-hidden">
      <Link href={`/market/${l.id}`} className="absolute inset-0 z-10" aria-label={`${l.crop}, ${l.quantity} ${unitLabel(l.unit)} in ${l.location.district}`} />
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Scene kind={sceneForCrop(l.crop)} className="transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {l.organic && (
            <Badge tone="success" className="bg-card/90">
              <Leaf className="h-3 w-3" aria-hidden /> Organic
            </Badge>
          )}
          {l.fpo && (
            <Badge tone="info" className="bg-card/90">
              FPO lot
            </Badge>
          )}
          {l.status !== "AVAILABLE" && <Badge tone="warning" className="bg-card/90">{l.status}</Badge>}
        </div>
        <div className="absolute right-1 top-1 z-20">
          <SaveButton targetType="LISTING" targetId={l.id} saved={l.saved} className="rounded-full bg-card/85 !px-2 shadow" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg">
              {l.crop}
              {l.variety ? <span className="font-medium text-muted-foreground"> · {l.variety}</span> : null}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {[l.location.village, l.location.district].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold tabular-nums text-primary">{formatINR(l.expectedPrice)}</p>
            <p className="text-xs text-muted-foreground">per {unitLabel(l.unit).toLowerCase()}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
            {l.quantity} {unitLabel(l.unit)}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Wheat className="h-4 w-4" aria-hidden />
            Grade {l.grade}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {formatShortDate(l.harvestDate)}
          </span>
        </div>
        <div className="relative z-20 mt-auto flex items-center justify-between gap-2 pt-3">
          <UserLine user={l.owner} size="sm" sub={l.owner.verified ? (l.owner.badge ?? "Verified") : undefined} showDemo={false} className="max-w-[75%]" />
          {l.isDemo && <DemoBadge />}
        </div>
      </div>
    </Card>
  );
}

const respondForm = z.object({ message: z.string().trim().min(5, "Write at least a few words").max(800), listingId: z.string().optional() });

export function RequirementCard({ r, canRespond }: { r: RequirementDTO; canRespond: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(r.responded);
  const toast = useToast();
  const mine = useGet<Page<ListingCardDTO>>(open && canRespond ? "/listings?mine=1" : null);
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof respondForm>>({ resolver: zodResolver(respondForm), defaultValues: { message: `Namaste, I can supply ${r.crop}. Please let me know the pickup details.`, listingId: "" } });
  const submit = handleSubmit(async (v) => {
    try {
      await api("POST", `/requirements/${r.id}/respond`, { message: v.message, listingId: v.listingId || undefined });
      setDone(true);
      setOpen(false);
      toast({ title: "Response sent", description: `${r.businessName} will see your message in Messages.` });
    } catch (e) {
      setError("message", { message: e instanceof ApiClientError ? e.message : "Couldn't send" });
    }
  });
  const left = daysUntil(r.windowEnd);
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <UserLine user={r.buyer} sub={r.businessName} />
        {r.matchScore != null && <Badge tone={r.matchScore >= 70 ? "success" : "warning"}>{r.matchScore}% match</Badge>}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg">
          Needs {r.quantity} {unitLabel(r.unit)} {r.crop}
        </h2>
        {r.isDemo && <DemoBadge />}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden />
          {r.district}, {r.state}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4" aria-hidden />
          {formatShortDate(r.windowStart)} – {formatShortDate(r.windowEnd)}
          {left >= 0 && left <= 14 ? ` · ${left}d left` : ""}
        </span>
      </p>
      {r.notes && <p className="mt-2 line-clamp-3 text-sm">{r.notes}</p>}
      {canRespond && !r.isOwn && (
        <div className="mt-auto pt-4">
          {done ? (
            <Badge tone="success">Response sent ✓</Badge>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>
              I can supply this <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={`Respond to ${r.businessName}`} description={`${r.quantity} ${unitLabel(r.unit)} ${r.crop} · ${r.district}`} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} loading={formState.isSubmitting}>Send response</Button></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Notice tone="warning">Agree price and pickup directly with the buyer. KaamSetu doesn&apos;t handle payments — never pay or share OTP/bank PIN.</Notice>
          {mine.data && mine.data.items.length > 0 && (
            <Field label="Attach one of your listings (optional)">
              {(a) => (
                <Select {...a} {...register("listingId")}>
                  <option value="">None</option>
                  {mine.data.items.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.crop} · {l.quantity} {unitLabel(l.unit)} · {formatINR(l.expectedPrice)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Message" error={formState.errors.message?.message} required>
            {(a) => <Textarea {...a} {...register("message")} rows={4} />}
          </Field>
        </form>
      </Sheet>
    </Card>
  );
}

export function EventCard({ e, compact }: { e: EventDTO; compact?: boolean }) {
  const d = new Date(e.startsAt);
  return (
    <Card className="group relative flex overflow-hidden">
      <Link href={`/events/${e.id}`} className="absolute inset-0 z-10" aria-label={e.name} />
      <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-primary/10 p-2 text-primary">
        <span className="text-xs font-bold uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
        <span className="text-3xl font-extrabold leading-none">{d.getDate()}</span>
        <span className="mt-1 text-[11px]">{formatTime(e.startsAt)}</span>
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">{e.category}</Badge>
          {e.status === "LIVE" && (
            <Badge tone="danger">
              <Radio className="h-3 w-3" aria-hidden /> LIVE
            </Badge>
          )}
          {e.registered && <Badge tone="success">Registered</Badge>}
          {e.isDemo && <DemoBadge />}
        </div>
        <h2 className="line-clamp-2 text-base">{e.name}</h2>
        {!compact && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
        <p className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {e.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {e.registrationCount}
          </span>
        </p>
      </div>
    </Card>
  );
}

export function SchemeCard({ s }: { s: SchemeDTO }) {
  return (
    <Card className="group relative flex flex-col p-4">
      <Link href={`/schemes/${s.id}`} className="absolute inset-0 z-10 rounded-2xl" aria-label={s.name} />
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="info">{s.category}</Badge>
        <Badge tone="outline">{s.state}</Badge>
        {s.isDemo && <DemoBadge />}
        {s.daysLeft != null && s.daysLeft >= 0 && <Badge tone={s.daysLeft <= 14 ? "danger" : "warning"}>{s.daysLeft}d left</Badge>}
      </div>
      <h2 className="text-base">{s.name}</h2>
      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
      <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" aria-hidden /> {s.org.name}
      </p>
    </Card>
  );
}

export function CourseCard({ c }: { c: CourseCardDTO }) {
  return (
    <Card className="group relative flex flex-col overflow-hidden">
      <Link href={`/learning/${c.id}`} className="absolute inset-0 z-10" aria-label={c.title} />
      <div className="aspect-[16/8] overflow-hidden">
        <Scene kind={c.scene} className="transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <Badge tone="primary">{c.category}</Badge>
          <Badge tone="outline">{c.level}</Badge>
          {c.completed && <Badge tone="success">Completed</Badge>}
        </div>
        <h2 className="text-base">{c.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
        <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            {pluralize(c.moduleCount, "module")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {c.totalMinutes} min
          </span>
        </p>
        {c.progressPct > 0 && (
          <div className="mt-3">
            <Progress value={c.progressPct} label={`${c.title} progress`} tone={c.completed ? "success" : "primary"} />
            <p className="mt-1 text-xs text-muted-foreground">{c.progressPct}% complete</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CommunityCard({ c }: { c: CommunityDTO }) {
  return (
    <Card className="group relative flex overflow-hidden">
      <Link href={`/communities/${c.id}`} className="absolute inset-0 z-10" aria-label={c.name} />
      <div className="w-24 shrink-0 overflow-hidden">
        <Scene kind={c.scene} />
      </div>
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-center gap-1.5">
          <Badge tone="neutral">{c.kind}</Badge>
          {c.joined && <Badge tone="success">Joined</Badge>}
        </div>
        <h2 className="mt-1 truncate text-base">{c.name}</h2>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {pluralize(c.memberCount, "member")} · {pluralize(c.postCount, "post")}
        </p>
      </div>
    </Card>
  );
}

export function QuestionCard({ q }: { q: QuestionDTO }) {
  return (
    <Card className="group relative p-4">
      <Link href={`/experts/questions/${q.id}`} className="absolute inset-0 z-10 rounded-2xl" aria-label={`Question: ${q.body.slice(0, 60)}`} />
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{q.category}</Badge>
        {q.crop && <Badge tone="neutral">{q.crop}</Badge>}
        <Badge tone={q.status === "ANSWERED" ? "success" : "warning"}>{q.status === "ANSWERED" ? "Answered" : "Awaiting expert"}</Badge>
        {q.isDemo && <DemoBadge />}
      </div>
      <p className="line-clamp-3 font-medium">{q.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {q.asker.name} · {q.district ? `${q.district} · ` : ""}
        {timeAgo(q.createdAt)} · {pluralize(q.answers.length, "answer")}
      </p>
    </Card>
  );
}

const OPP_ICON: Record<string, typeof Landmark> = { SCHEME: Landmark, EVENT: CalendarDays, COURSE: GraduationCap, TRAINING: GraduationCap, MACHINERY: Tractor, BUYER_REQUIREMENT: Package, FPO: Users, PRODUCE: Wheat, WORK: Briefcase };
const OPP_LABEL: Record<string, string> = { BUYER_REQUIREMENT: "Buyer needs", SCHEME: "Scheme", TRAINING: "Training", MACHINERY: "Machinery", EVENT: "Event", FPO: "FPO", COURSE: "Course", PRODUCE: "Produce", WORK: "Work" };

export function OpportunityCard({ o, className }: { o: OpportunityDTO; className?: string }) {
  const Icon = OPP_ICON[o.kind] ?? Leaf;
  return (
    <Card className={cn("group relative flex h-full flex-col overflow-hidden", className)}>
      <Link href={o.href} className="absolute inset-0 z-10" aria-label={o.title} />
      <div className="flex gap-3 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{OPP_LABEL[o.kind] ?? o.kind}</span>
            {o.badge && <Badge tone="warning">{o.badge}</Badge>}
            {o.isDemo && <DemoBadge />}
          </div>
          <h2 className="line-clamp-2 text-base">{o.title}</h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{o.subtitle}</p>
        </div>
      </div>
      <p className="mt-auto border-t bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="font-bold text-foreground">Why this: </span>
        {o.reason}
      </p>
    </Card>
  );
}

export function MachineryCard({ m, children }: { m: MachineryDTO; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="aspect-[16/7] overflow-hidden">
        <Scene kind="tractor" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{m.type}</Badge>
          <Badge tone={m.available ? "success" : "warning"}>{m.available ? "Available" : "Busy"}</Badge>
        </div>
        <h2 className="text-base">{m.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {m.district}, {m.state}
        </p>
        <p className="mt-1 line-clamp-2 text-sm">{m.description}</p>
        <p className="mt-2 text-lg font-extrabold text-primary">
          {formatINR(m.rate)} <span className="text-xs font-medium text-muted-foreground">/ {m.rateUnit.toLowerCase()}</span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <UserLine user={m.owner} size="sm" sub="Owner" showDemo={false} className="max-w-[60%]" />
          {children}
        </div>
      </div>
    </Card>
  );
}

export { formatDate };
