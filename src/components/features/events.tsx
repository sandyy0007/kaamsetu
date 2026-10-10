"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, BellOff, CalendarCheck, CalendarDays, Plus, Radio, Send, Video } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Notice, PageHeader, Stat } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Segmented, Tabs } from "@/components/ui/tabs";
import { useGet, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { roleCan } from "@/lib/capabilities";
import { DISTRICT_NAMES } from "@/lib/geo";
import { cn, daysUntil, formatDate, formatTime, timeAgo } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/types/domain";
import type { EventDTO, LiveDTO, LiveMessageDTO } from "@/types/dto";
import { FollowButton, SaveButton, ShareButton } from "./actions";
import { EventCard } from "./cards";
import { SearchField, useDebounced } from "./filters";
import { UserLine } from "./people";

export function EventsView() {
  const me = useMe().data;
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const p = new URLSearchParams({ when });
  if (category) p.set("category", category);
  if (district) p.set("district", district);
  if (dq) p.set("q", dq);
  if (mine) p.set("mine", "1");
  const query = useGet<EventDTO[]>(`/events?${p}`, { keepPrevious: true });
  const canCreate = !!me && roleCan(me.role, "event:create");
  return (
    <div>
      <PageHeader title="Events" subtitle="Kisan melas, camps, trainings and demos near you." actions={<div className="flex gap-2"><ButtonLink href="/live" variant="outline"><Radio className="h-4 w-4" /> Live</ButtonLink>{canCreate && <ButtonLink href="/create?type=event"><Plus className="h-4 w-4" /> New event</ButtonLink>}</div>} />
      <div className="mb-5 space-y-3">
        <SearchField value={q} onChange={setQ} label="Search events" placeholder="Search events" />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Segmented label="When" value={when} onChange={setWhen} items={[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }]} />
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">Any district</option>{DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}</Select>
          {canCreate && <button aria-pressed={mine} onClick={() => setMine((m) => !m)} className={cn("tap rounded-xl border px-3 text-sm font-semibold", mine ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}>My events</button>}
        </div>
      </div>
      {query.isLoading ? <ListSkeleton count={4} /> : query.isError ? <Card><ErrorState error={query.error} onRetry={() => void query.refetch()} /></Card> : !query.data?.length ? (
        <Card><EmptyState icon={<CalendarDays className="h-7 w-7" />} title={when === "past" ? "No past events" : "No upcoming events"} description="Try another category or district." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{query.data.map((e) => <EventCard key={e.id} e={e} />)}</div>
      )}
    </div>
  );
}

export function EventDetail({ id }: { id: string }) {
  const me = useMe().data;
  const toast = useToast();
  const q = useGet<EventDTO>(`/events/${id}`);
  const opts = { invalidate: ["/events", "/home"], onError: (e: Error) => toast({ kind: "error", title: "Couldn't update", description: e.message }) };
  const reg = useSend<{ on: boolean }, EventDTO>("POST", `/events/${id}/register`, { ...opts, onSuccess: (e) => toast({ title: e.registered ? "You're registered" : "Registration cancelled" }) });
  const rem = useSend<{ on: boolean }, EventDTO>("POST", `/events/${id}/reminder`, { ...opts, onSuccess: (e) => toast({ title: e.reminder ? "Reminder on" : "Reminder off" }) });
  if (q.isLoading) return <ListSkeleton count={2} media />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Event not found" /></Card>;
  const e = q.data;
  const left = daysUntil(e.startsAt);
  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/events" className="text-sm font-semibold text-primary hover:underline">← All events</Link>
      <Card className="overflow-hidden">
        <div className="aspect-[16/6]"><Scene kind={e.scene} /></div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-1.5"><Badge tone="accent">{e.category}</Badge>{e.status === "LIVE" && <Badge tone="danger"><Radio className="h-3 w-3" /> LIVE now</Badge>}{e.status === "ENDED" && <Badge>Ended</Badge>}{e.isDemo && <DemoBadge />}</div>
          <h1 className="text-2xl">{e.name}</h1>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="When" value={formatDate(e.startsAt)} hint={`${formatTime(e.startsAt)} – ${formatTime(e.endsAt)}${left > 0 && left <= 30 ? ` · in ${left}d` : ""}`} />
            <Stat label="Where" value={e.location} hint={e.district} />
            <Stat label="Registered" value={e.registrationCount} />
          </div>
          <p className="whitespace-pre-line">{e.description}</p>
          {e.topics.length > 0 && <div className="flex flex-wrap gap-1.5">{e.topics.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</div>}
          <UserLine user={e.organizer} sub="Organiser" />
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            {e.status !== "ENDED" && !e.isOwn && me && (
              <Button variant={e.registered ? "outline" : "primary"} loading={reg.isPending} onClick={() => reg.mutate({ on: !e.registered })} aria-pressed={e.registered}>
                <CalendarCheck className="h-4 w-4" /> {e.registered ? "Registered — cancel" : "Register"}
              </Button>
            )}
            {e.status !== "ENDED" && e.registered && (
              <Button variant="outline" loading={rem.isPending} onClick={() => rem.mutate({ on: !e.reminder })} aria-pressed={e.reminder}>
                {e.reminder ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />} {e.reminder ? "Turn off reminder" : "Remind me"}
              </Button>
            )}
            {e.liveSessionId && <ButtonLink href={`/live/${e.liveSessionId}`} variant="accent"><Video className="h-4 w-4" /> Live session</ButtonLink>}
            <SaveButton targetType="EVENT" targetId={e.id} saved={e.saved} label />
            <ShareButton title={e.name} path={`/events/${e.id}`} />
          </div>
          {!me && <p className="text-sm text-muted-foreground">Sign in to register for this event.</p>}
        </div>
      </Card>
    </div>
  );
}

// ───────── Live ─────────
function LiveCard({ l }: { l: LiveDTO }) {
  return (
    <Card className="group relative overflow-hidden">
      <Link href={`/live/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative aspect-[16/8]"><Scene kind={l.scene} />
        <div className="absolute left-2 top-2">{l.status === "LIVE" ? <Badge tone="danger" className="bg-card/90"><Radio className="h-3 w-3" /> LIVE</Badge> : l.status === "SCHEDULED" ? <Badge tone="info" className="bg-card/90">{formatDate(l.scheduledAt)} · {formatTime(l.scheduledAt)}</Badge> : <Badge className="bg-card/90">Ended</Badge>}</div>
      </div>
      <div className="p-4"><h2 className="text-base">{l.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.description}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><UserAvatar user={l.host} size="sm" /> {l.host.name}{l.isDemo && <DemoBadge />}</p></div>
    </Card>
  );
}

export function LiveListView() {
  const sp = useSearchParams();
  const router = useRouter();
  const legacy = sp.get("id");
  useEffect(() => {
    if (legacy) router.replace(`/live/${legacy}`);
  }, [legacy, router]);
  const me = useMe().data;
  const q = useGet<LiveDTO[]>("/live", { refetchInterval: 30000 });
  return (
    <div>
      <PageHeader title="Live" subtitle="Sessions with experts, officers and farmers." actions={me && roleCan(me.role, "live:host") ? <ButtonLink href="/create?type=live"><Plus className="h-4 w-4" /> Schedule a session</ButtonLink> : undefined} />
      <Notice tone="info" title="Streaming is not connected in this build">Sessions, chat and Q&amp;A work. Video streaming plugs into a provider adapter (LiveKit, Mux, Agora…) — no stream is simulated here.</Notice>
      <div className="mt-5">
        {q.isLoading ? <ListSkeleton count={3} media /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card> : !q.data?.length ? <Card><EmptyState icon={<Video className="h-7 w-7" />} title="No sessions yet" /></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{q.data.map((l) => <LiveCard key={l.id} l={l} />)}</div>
        )}
      </div>
    </div>
  );
}

const chatForm = z.object({ body: z.string().trim().min(1, "Write something").max(300, "Keep it under 300 characters") });

export function LiveSession({ id }: { id: string }) {
  const me = useMe().data;
  const toast = useToast();
  const [tab, setTab] = useState<"chat" | "questions">("chat");
  const q = useGet<LiveDTO>(`/live/${id}`, { refetchInterval: 15000 });
  const msgs = useGet<LiveMessageDTO[]>(`/live/${id}/messages`, { refetchInterval: 5000, staleTime: 0 });
  const { register, handleSubmit, reset, formState, setError } = useForm<z.infer<typeof chatForm>>({ resolver: zodResolver(chatForm), defaultValues: { body: "" } });
  const end = useRef<HTMLDivElement>(null);
  const status = useSend<{ status: "LIVE" | "ENDED" }, LiveDTO>("POST", `/live/${id}/status`, { invalidate: ["/live"], onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }) });
  const list = (msgs.data ?? []).filter((m) => tab === "chat" || m.isQuestion);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [list.length, tab]);
  const post = useSend<{ body: string; isQuestion: boolean }, LiveMessageDTO>("POST", `/live/${id}/messages`, { invalidate: [`/live/${id}/messages`] });
  const send = handleSubmit((v) =>
    post.mutateAsync({ body: v.body, isQuestion: tab === "questions" }).then(
      () => reset(),
      (e: Error) => setError("body", { message: e.message }),
    ),
  );
  if (q.isLoading) return <ListSkeleton count={2} media />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Session not found" /></Card>;
  const l = q.data;
  return (
    <div className="space-y-4">
      <Link href="/live" className="text-sm font-semibold text-primary hover:underline">← All sessions</Link>
      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              <div style={{ filter: "brightness(var(--scene-fixed, 1))" }} className="absolute inset-0 opacity-60"><Scene kind={l.scene} /></div>
              <div className="absolute inset-0 grid place-items-center bg-black/45 p-6 text-center text-white">
                <div><Video className="mx-auto h-10 w-10" aria-hidden /><p className="mt-2 font-bold">{l.streamConnected ? "Stream connected" : "Video stream not connected"}</p><p className="mx-auto mt-1 max-w-sm text-sm text-white/80">{l.status === "ENDED" ? "This session has ended." : l.status === "SCHEDULED" ? `Scheduled for ${formatDate(l.scheduledAt)} at ${formatTime(l.scheduledAt)}.` : "The session is live. Use chat and Q&A on this page."}</p></div>
              </div>
              <div className="absolute left-3 top-3">{l.status === "LIVE" ? <Badge tone="danger"><Radio className="h-3 w-3" /> LIVE</Badge> : <Badge>{l.status === "SCHEDULED" ? "Scheduled" : "Ended"}</Badge>}</div>
            </div>
            <div className="space-y-3 p-4">
              <h1 className="text-xl">{l.title}</h1>
              <p className="text-muted-foreground">{l.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-3"><UserLine user={l.host} sub="Host" />{!l.isHost && <FollowButton userId={l.host.id} following={l.followingHost} />}</div>
              {l.event && <p className="text-sm">Part of <Link className="font-semibold text-primary hover:underline" href={`/events/${l.event.id}`}>{l.event.name}</Link></p>}
              {l.isHost && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {l.status === "SCHEDULED" && <Button onClick={() => status.mutate({ status: "LIVE" })} loading={status.isPending}>Mark as live</Button>}
                  {l.status === "LIVE" && <Button variant="outline" onClick={() => status.mutate({ status: "ENDED" })} loading={status.isPending}>End session</Button>}
                </div>
              )}
            </div>
          </Card>
        </div>
        <Card className="flex h-[32rem] flex-col overflow-hidden lg:h-[36rem]">
          <div className="border-b p-2"><Tabs label="Live panels" value={tab} onChange={setTab} items={[{ id: "chat", label: "Chat" }, { id: "questions", label: "Questions" }]} /></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" role="log" aria-live="polite" aria-label={tab === "chat" ? "Live chat" : "Questions"}>
            {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">{tab === "chat" ? "No messages yet. Say hello!" : "No questions yet. Ask the host something."}</p>}
            {list.map((m) => (
              <div key={m.id} className="flex gap-2"><UserAvatar user={m.user} size="sm" /><div className="min-w-0"><p className="text-xs"><span className="font-bold">{m.user.name}</span> <span className="text-muted-foreground">{timeAgo(m.createdAt)}</span>{m.isQuestion && tab === "chat" && <Badge tone="accent" className="ml-1.5">Question</Badge>}</p><p className="break-words text-sm">{m.body}</p></div></div>
            ))}
            <div ref={end} />
          </div>
          {me ? (
            <form onSubmit={send} noValidate className="border-t p-3">
              <div className="flex gap-2">
                <label htmlFor="live-msg" className="sr-only">{tab === "chat" ? "Chat message" : "Your question"}</label>
                <Input id="live-msg" {...register("body")} placeholder={tab === "chat" ? "Write a message…" : "Ask a question…"} autoComplete="off" aria-invalid={!!formState.errors.body} />
                <Button type="submit" size="icon" aria-label="Send" loading={post.isPending}><Send className="h-5 w-5" /></Button>
              </div>
              {formState.errors.body && <p role="alert" className="mt-1 text-xs text-danger">{formState.errors.body.message}</p>}
            </form>
          ) : <p className="border-t p-3 text-center text-sm text-muted-foreground">Sign in to join the chat.</p>}
        </Card>
      </div>
    </div>
  );
}
