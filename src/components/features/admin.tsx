"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Check, Eye, EyeOff, Flag, ShieldAlert, ShieldCheck, Trash2, Users as UsersIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarChart, HBars, LineChart } from "@/components/art/charts";
import { useToast } from "@/components/providers/toast";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice, PageHeader, Stat } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { useGet, useInvalidate, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Role } from "@/types/domain";
import type { AdminContentRow, AdminOverviewDTO, AdminReportRow, AdminUserRow, AdminVerificationRow } from "@/types/dto";
import { ProfessionsAdmin, SkillsAdmin } from "./admin-professions";
import { SearchField, useDebounced } from "./filters";

type Tab = "overview" | "users" | "verifications" | "professions" | "skills" | "reports" | "content" | "system";
const TAB_IDS: Tab[] = ["overview", "users", "verifications", "professions", "skills", "reports", "content", "system"];

function Overview() {
  const q = useGet<AdminOverviewDTO>("/admin/overview", { staleTime: 0 });
  if (q.isLoading) return <ListSkeleton count={3} />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  const o = q.data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open reports" value={o.openReports} tone={o.openReports ? "danger" : undefined} />
        <Stat label="Pending verifications" value={o.pendingVerifications} tone={o.pendingVerifications ? "primary" : undefined} />
        <Stat label="Demo records" value={o.demoRecords} />
        <Stat label="Real records" value={o.realRecords} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="mb-3 text-base">Users by role</h2><HBars rows={o.usersByRole.map((r) => ({ label: ROLE_LABEL[r.role as Role] ?? r.role, value: r.count }))} /></Card>
        <Card className="p-4"><h2 className="mb-3 text-base">Produce listings by crop</h2><HBars rows={o.listingsByCrop.map((r) => ({ label: r.crop, value: r.count }))} /></Card>
        <Card className="p-4"><LineChart title="Sign-ups, last 14 days" data={o.signups.map((s) => ({ label: s.day.slice(5), value: s.count }))} /></Card>
        <Card className="p-4"><BarChart title="Platform records" money={false} series={["Count"]} data={Object.entries(o.counts).map(([label, v]) => ({ label, values: [v] }))} /></Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const dq = useDebounced(q.trim());
  const p = new URLSearchParams();
  if (dq) p.set("q", dq);
  if (role) p.set("role", role);
  const list = useGet<AdminUserRow[]>(`/admin/users${p.size ? `?${p}` : ""}`, { staleTime: 0, keepPrevious: true });
  const toast = useToast();
  const set = useSend<{ id: string; status: "ACTIVE" | "SUSPENDED" }, unknown>("PATCH", (v) => `/admin/users/${v.id}`, { invalidate: ["/admin"], onSuccess: () => toast({ title: "User updated" }), onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }) });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]"><SearchField value={q} onChange={setQ} label="Search users" placeholder="Name, handle or email" voice={false} /><Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></div>
      {list.isLoading ? <ListSkeleton count={4} /> : list.isError ? <Card><ErrorState error={list.error} onRetry={() => void list.refetch()} /></Card> : !list.data?.length ? <Card><EmptyState icon={<UsersIcon className="h-7 w-7" />} title="No users match" /></Card> : (
        <Card><ul className="divide-y">{list.data.map((r) => (
          <li key={r.user.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <UserAvatar user={r.user} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-bold">{r.user.name}<Badge tone="neutral">{ROLE_LABEL[r.user.role] ?? r.user.role}</Badge>{r.user.verified && <Badge tone="info">Verified</Badge>}{r.status === "SUSPENDED" && <Badge tone="danger">Suspended</Badge>}{r.user.isDemo && <DemoBadge />}</p>
              <p className="truncate text-xs text-muted-foreground">{r.email ?? "—"} · joined {formatDate(r.createdAt)}</p>
              {r.risk.score > 0 && <p className="mt-0.5 text-xs text-warning">Risk {r.risk.score}: {r.risk.reasons.join("; ")}</p>}
            </div>
            {r.status === "ACTIVE" ? <Button size="sm" variant="outline" onClick={() => set.mutate({ id: r.user.id, status: "SUSPENDED" })}><Ban className="h-4 w-4" /> Suspend</Button> : <Button size="sm" variant="outline" onClick={() => set.mutate({ id: r.user.id, status: "ACTIVE" })}><Check className="h-4 w-4" /> Reinstate</Button>}
          </li>))}</ul></Card>
      )}
    </div>
  );
}

function Verifications() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const q = useGet<AdminVerificationRow[]>(`/admin/verifications?status=${status}`, { staleTime: 0 });
  const toast = useToast();
  const [note, setNote] = useState<Record<string, string>>({});
  const review = useSend<{ id: string; decision: "APPROVED" | "REJECTED"; note?: string }, unknown>("POST", (v) => `/admin/verifications/${v.id}/review`, { invalidate: ["/admin", "/notifications"], onSuccess: () => toast({ title: "Review saved" }), onError: (e) => toast({ kind: "error", title: "Couldn't save", description: e.message }) });
  return (
    <div className="space-y-4">
      <Tabs label="Verification status" value={status} onChange={setStatus} items={[{ id: "PENDING", label: "Pending" }, { id: "APPROVED", label: "Approved" }, { id: "REJECTED", label: "Rejected" }]} />
      <Notice tone="info">Review documents outside KaamSetu. Document numbers are never collected or stored here — only the labels people say they can provide.</Notice>
      {q.isLoading ? <ListSkeleton count={3} /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card> : !q.data?.length ? <Card><EmptyState icon={<ShieldCheck className="h-7 w-7" />} title={`No ${status.toLowerCase()} requests`} /></Card> : (
        <div className="space-y-3">{q.data.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2.5"><UserAvatar user={r.user} /><div><p className="font-bold">{r.user.name}</p><p className="text-xs text-muted-foreground">{ROLE_LABEL[r.user.role] ?? r.user.role} · wants <b>{r.kind}</b> badge{r.targetName ? <> for <b>{r.targetName}</b></> : null} · {timeAgo(r.createdAt)}</p></div></div>{r.user.isDemo && <DemoBadge />}</div>
            <p className="mt-3 text-sm">{r.note}</p>
            <p className="mt-2 flex flex-wrap gap-1.5">{r.documentLabels.map((d) => <Badge key={d} tone="outline">{d}</Badge>)}</p>
            {r.reviewNote && <p className="mt-2 text-sm text-muted-foreground">Review note: {r.reviewNote}</p>}
            {r.status === "PENDING" && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1"><label className="sr-only" htmlFor={`n-${r.id}`}>Review note</label><Input id={`n-${r.id}`} placeholder="Optional note to the user" maxLength={300} value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} /></div>
                <Button size="sm" onClick={() => review.mutate({ id: r.id, decision: "APPROVED", note: note[r.id] })} loading={review.isPending}><Check className="h-4 w-4" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, decision: "REJECTED", note: note[r.id] })}><X className="h-4 w-4" /> Reject</Button>
              </div>
            )}
          </Card>))}</div>
      )}
    </div>
  );
}

function Reports() {
  const q = useGet<AdminReportRow[]>("/admin/reports", { staleTime: 0 });
  const toast = useToast();
  const resolve = useSend<{ id: string; action: "HIDE_CONTENT" | "SUSPEND_USER" | "DISMISS" }, unknown>("POST", (v) => `/admin/reports/${v.id}/resolve`, { invalidate: ["/admin"], onSuccess: () => toast({ title: "Report resolved" }), onError: (e) => toast({ kind: "error", title: "Couldn't resolve", description: e.message }) });
  const open = (q.data ?? []).filter((r) => r.status === "OPEN");
  const closed = (q.data ?? []).filter((r) => r.status !== "OPEN");
  if (q.isLoading) return <ListSkeleton count={3} />;
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  return (
    <div className="space-y-5">
      <Notice tone="info">Content with 3 or more reports is hidden automatically until you review it. Dismissing restores it.</Notice>
      {!open.length ? <Card><EmptyState icon={<Flag className="h-7 w-7" />} title="No open reports" description="Nothing needs review right now." /></Card> : (
        <div className="space-y-3">{open.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="danger">{r.reason}</Badge><Badge tone="neutral">{r.targetType}</Badge><span className="text-xs text-muted-foreground">reported by {r.reporter.name} · {timeAgo(r.createdAt)}</span></div>
            <p className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">{r.targetPreview}</p>
            {r.details && <p className="mt-2 text-sm text-muted-foreground">“{r.details}”</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r.id, action: "HIDE_CONTENT" })}><EyeOff className="h-4 w-4" /> Hide content</Button>
              <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r.id, action: "SUSPEND_USER" })}><Ban className="h-4 w-4" /> Suspend user</Button>
              <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, action: "DISMISS" })}>Dismiss</Button>
            </div>
          </Card>))}</div>
      )}
      {closed.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Resolved ({closed.length})</summary><ul className="mt-2 divide-y rounded-2xl border bg-card">{closed.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span className="line-clamp-1">{r.targetPreview}</span><Badge tone={r.status === "ACTIONED" ? "success" : "neutral"}>{r.status}</Badge></li>)}</ul></details>}
    </div>
  );
}

const CONTENT_TYPES = ["posts", "reels", "services", "opportunities", "businesses", "listings", "requirements", "events", "schemes", "live", "communities", "health", "questions", "machinery", "courses"] as const;

function Content() {
  const [type, setType] = useState<(typeof CONTENT_TYPES)[number]>("posts");
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const list = useGet<AdminContentRow[]>(`/admin/content?type=${type}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`, { staleTime: 0, keepPrevious: true });
  const toast = useToast();
  const hide = useSend<{ id: string; hidden: boolean }, unknown>("PATCH", (v) => `/admin/content/${type}/${v.id}`, { invalidate: ["/admin"], onSuccess: () => toast({ title: "Updated" }), onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }) });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]"><Select aria-label="Content type" value={type} onChange={(e) => setType(e.target.value as (typeof CONTENT_TYPES)[number])}>{CONTENT_TYPES.map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</Select><SearchField value={q} onChange={setQ} label="Search content" placeholder="Search" voice={false} /></div>
      {list.isLoading ? <ListSkeleton count={4} /> : list.isError ? <Card><ErrorState error={list.error} onRetry={() => void list.refetch()} /></Card> : !list.data?.length ? <Card><EmptyState title="Nothing here" /></Card> : (
        <Card><ul className="divide-y">{list.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-1.5 font-semibold">{r.href ? <Link href={r.href} className="hover:underline">{r.title}</Link> : r.title}{r.hidden && <Badge tone="warning">Hidden</Badge>}{r.isDemo && <DemoBadge />}</p><p className="text-xs text-muted-foreground">{r.subtitle}</p></div>
            <Button size="sm" variant="outline" onClick={() => hide.mutate({ id: r.id, hidden: !r.hidden })}>{r.hidden ? <><Eye className="h-4 w-4" /> Restore</> : <><EyeOff className="h-4 w-4" /> Hide</>}</Button>
          </li>))}</ul></Card>
      )}
    </div>
  );
}

const purgeForm = z.object({ confirm: z.string().refine((v) => v.trim() === "REMOVE DEMO DATA", 'Type exactly: REMOVE DEMO DATA') });

function System({ demoCount }: { demoCount: number }) {
  const me = useMe().data;
  const toast = useToast();
  const invalidate = useInvalidate();
  const { register, handleSubmit, formState, setError, reset } = useForm<z.infer<typeof purgeForm>>({ resolver: zodResolver(purgeForm), defaultValues: { confirm: "" } });
  const submit = handleSubmit(async (v) => {
    try {
      const r = await api<{ removed: unknown }>("POST", "/admin/purge-demo", v);
      toast({ title: "Demo data removed", description: typeof r.removed === "number" ? `${r.removed} records` : undefined });
      reset();
      await invalidate("/");
    } catch (e) {
      setError("confirm", { message: e instanceof ApiClientError ? e.message : "Couldn't remove demo data" });
    }
  });
  return (
    <Card className="max-w-2xl space-y-4 p-5">
      <div><h2 className="flex items-center gap-2 text-lg"><ShieldAlert className="h-5 w-5 text-danger" /> Remove demo data</h2><p className="mt-1 text-sm text-muted-foreground">Deletes every record marked DEMO ({demoCount} now), including demo accounts. Records created by real users stay. This cannot be undone.</p></div>
      {me?.isDemo ? <Notice tone="warning">You&apos;re signed in with a demo admin account. Sign in with a real admin account first, or you would lock yourself out.</Notice> : null}
      <form onSubmit={submit} noValidate className="space-y-3">
        <Field label="Type REMOVE DEMO DATA to confirm" error={formState.errors.confirm?.message}>{(a) => <Input {...a} {...register("confirm")} autoComplete="off" />}</Field>
        <Button type="submit" variant="danger" loading={formState.isSubmitting}><Trash2 className="h-4 w-4" /> Remove demo data</Button>
      </form>
    </Card>
  );
}

export function AdminView() {
  const me = useMe().data;
  const router = useRouter();
  const sp = useSearchParams();
  const overview = useGet<AdminOverviewDTO>("/admin/overview", { enabled: me?.role === "ADMIN" });
  const tab = (TAB_IDS.includes((sp.get("tab") ?? "") as Tab) ? sp.get("tab") : "overview") as Tab;
  useEffect(() => {
    if (me && me.role !== "ADMIN") router.replace("/home");
  }, [me, router]);
  if (!me || me.role !== "ADMIN") return <ListSkeleton count={2} />;
  return (
    <div>
      <PageHeader title="Admin" subtitle="Moderation, verification and platform health." />
      <Tabs<Tab> label="Admin sections" className="mb-5" value={tab} onChange={(t) => router.replace(`/admin?tab=${t}`, { scroll: false })} items={[{ id: "overview", label: "Overview" }, { id: "users", label: "Users" }, { id: "verifications", label: "Verifications", count: overview.data?.pendingVerifications || undefined }, { id: "professions", label: "Professions" }, { id: "skills", label: "Skills" }, { id: "reports", label: "Reports", count: overview.data?.openReports || undefined }, { id: "content", label: "Content" }, { id: "system", label: "System" }]} />
      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "verifications" && <Verifications />}
      {tab === "professions" && <ProfessionsAdmin />}
      {tab === "skills" && <SkillsAdmin />}
      {tab === "reports" && <Reports />}
      {tab === "content" && <Content />}
      {tab === "system" && <System demoCount={overview.data?.demoRecords ?? 0} />}
    </div>
  );
}
