"use client";
import { Briefcase, CalendarDays, Clock, MapPin, MessageCircle, Phone, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader, Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, QueryBoundary } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { flatten, useGet, useInfiniteList, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api } from "@/lib/api";
import { roleCan } from "@/lib/capabilities";
import { DISTRICT_NAMES } from "@/lib/geo";
import { formatDate, formatShortDate } from "@/lib/utils";
import { WORK_KINDS } from "@/types/domain";
import type { ApplicationDTO, MyWorkDTO, ServiceDTO, ServiceRequestDTO, WorkOpportunityDTO } from "@/types/dto";
import { SaveButton, ReportButton, ShareButton } from "./actions";
import { FilterPanel, SearchField, useDebounced } from "./filters";
import { OpportunitiesView } from "./government";
import { UserLine } from "./people";
import { OpportunityForm, ServiceForm } from "./pro-forms";
import { ApplySheet, AvailabilityBadge, Chips, ReputationFacts, ServiceCard, WORK_KIND_LABEL, WorkCard, useCatalog } from "./pro-shared";

// ───────────── Work list with filters ─────────────
export function WorkList({ onPost }: { onPost?: () => void }) {
  const sp = useSearchParams();
  const { data: catalog } = useCatalog();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [kind, setKind] = useState("");
  const [profession, setProfession] = useState("");
  const [skill, setSkill] = useState("");
  const [district, setDistrict] = useState("");
  const [maxKm, setMaxKm] = useState("");
  const [sort, setSort] = useState("newest");
  const dq = useDebounced(q);
  const dSkill = useDebounced(skill);
  const list = useInfiniteList<WorkOpportunityDTO>("/work", { q: dq, kind, profession, skill: dSkill, near: district && maxKm ? district : "", district: district && !maxKm ? district : "", maxKm, sort });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const active = [kind, profession, skill, district, maxKm].filter(Boolean).length;
  const clear = () => {
    setKind("");
    setProfession("");
    setSkill("");
    setDistrict("");
    setMaxKm("");
  };
  return (
    <div className="space-y-4">
      <SearchField value={q} onChange={setQ} label="Search work" placeholder="Search work — “electrician near Churu”, “tailor”, “driver”…" />
      <FilterPanel activeCount={active} onClear={clear}>
        <Select aria-label="Type of work" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Any type of work</option>
          {WORK_KINDS.map((k) => (
            <option key={k} value={k}>
              {WORK_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select aria-label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
          <option value="">Any profession</option>
          {catalog?.categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.professions
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Input aria-label="Skill" placeholder="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} />
        <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Anywhere</option>
          {DISTRICT_NAMES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select aria-label="Distance" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} disabled={!district}>
          <option value="">Exactly this district</option>
          <option value="25">Within 25 km</option>
          <option value="50">Within 50 km</option>
          <option value="100">Within 100 km</option>
        </Select>
        <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="distance" disabled={!district}>
            Nearest first
          </option>
        </Select>
      </FilterPanel>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {list.isLoading ? "Searching…" : `${list.data?.pages[0]?.total ?? 0} opportunities`}
      </p>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="h-7 w-7" />}
            title="No work found"
            description="Try a different place or profession, or clear the filters."
            action={active || q ? { label: "Clear search", onClick: () => { clear(); setQ(""); } } : onPost ? { label: "Post an opportunity", onClick: onPost } : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

// ───────────── Services list (Market → Services) ─────────────
export function ServicesList() {
  const { data: catalog } = useCatalog();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [profession, setProfession] = useState("");
  const dq = useDebounced(q);
  const list = useInfiniteList<ServiceDTO>("/services", { q: dq, near: district, profession });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  return (
    <div className="space-y-4">
      <SearchField value={q} onChange={setQ} label="Search services" placeholder="Search services — “house wiring”, “stitching”, “tractor repair”…" />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Select aria-label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
          <option value="">Any profession</option>
          {catalog?.categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.professions
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Select aria-label="Near district" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Anywhere</option>
          {DISTRICT_NAMES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </div>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Briefcase className="h-7 w-7" />} title="No services found" description="Try another search or place." />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((x) => (
              <ServiceCard key={x.id} s={x} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

// ───────────── Opportunity Center ─────────────
type Tab = "for-you" | "work";

function CenterInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: me } = useMe();
  const tab: Tab = sp.get("tab") === "work" ? "work" : "for-you";
  const [posting, setPosting] = useState(false);
  const canPost = roleCan(me?.role, "work:post");
  const setTab = (t: Tab) => router.replace(t === "work" ? "/opportunities?tab=work" : "/opportunities", { scroll: false });
  return (
    <div>
      <PageHeader
        title="Opportunity Center"
        subtitle="Work, service requests, apprenticeships, training, government programmes and events — matched to your profession and place."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/my-work" variant="outline" size="sm">
              <Briefcase className="h-4 w-4" /> My work
            </ButtonLink>
            {canPost && (
              <Button size="sm" onClick={() => setPosting(true)}>
                <Plus className="h-4 w-4" /> Post an opportunity
              </Button>
            )}
          </div>
        }
      />
      <Tabs
        label="Opportunity type"
        value={tab}
        onChange={setTab}
        items={[
          { id: "for-you", label: "For you" },
          { id: "work", label: "Work & jobs" },
        ]}
        className="mb-4"
      />
      {tab === "for-you" ? <OpportunitiesView embedded /> : <WorkList onPost={canPost ? () => setPosting(true) : undefined} />}
      <Sheet open={posting} onClose={() => setPosting(false)} title="Post an opportunity" description="Daily work, a contract, a job, an apprenticeship or a freelance project." size="lg">
        {posting && (
          <OpportunityForm
            onDone={(w) => {
              setPosting(false);
              router.push(`/opportunities/${w.id}`);
            }}
            onCancel={() => setPosting(false)}
          />
        )}
      </Sheet>
    </div>
  );
}

export function OpportunityCenter() {
  return (
    <Suspense>
      <CenterInner />
    </Suspense>
  );
}

// ───────────── Opportunity detail ─────────────
const APP_TONE = { APPLIED: "info", SHORTLISTED: "primary", ACCEPTED: "success", REJECTED: "danger", WITHDRAWN: "neutral" } as const;

function ApplicantRow({ a, onChanged }: { a: ApplicationDTO; onChanged: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const decide = async (status: "SHORTLISTED" | "ACCEPTED" | "REJECTED") => {
    setBusy(true);
    try {
      await api("PATCH", `/work/applications/${a.id}`, { status });
      toast({ title: status === "ACCEPTED" ? "Applicant accepted" : status === "REJECTED" ? "Applicant declined" : "Shortlisted" });
      onChanged();
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const open = a.status === "APPLIED" || a.status === "SHORTLISTED";
  return (
    <li className="rounded-xl border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {a.applicant ? (
          <div className="min-w-0 flex-1">
            <UserLine user={a.applicant.user} sub={`${a.applicant.profession.emoji} ${a.applicant.profession.name} · ${a.applicant.experienceYears} yrs · ${a.applicant.district}`} />
            <div className="mt-2 space-y-1.5 pl-12">
              <Chips items={a.applicant.skills} max={5} />
              <ReputationFacts r={a.applicant.reputation} />
              <AvailabilityBadge status={a.applicant.availability.status} label={a.applicant.availability.label} />
            </div>
          </div>
        ) : (
          <UserLine user={a.applicantUser} />
        )}
        <Badge tone={APP_TONE[a.status]}>{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</Badge>
      </div>
      {a.note && <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-sm">“{a.note}”</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Applied {formatShortDate(a.createdAt)}</span>
        <span className="flex-1" />
        {a.conversationId && (
          <Button size="sm" variant="outline" onClick={() => router.push(`/messages?c=${a.conversationId}`)}>
            <MessageCircle className="h-4 w-4" /> Message
          </Button>
        )}
        {open && (
          <>
            {a.status === "APPLIED" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("SHORTLISTED")}>
                Shortlist
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("REJECTED")}>
              Decline
            </Button>
            <Button size="sm" disabled={busy} onClick={() => decide("ACCEPTED")}>
              Accept
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function Applicants({ id }: { id: string }) {
  const q = useGet<ApplicationDTO[]>(`/work/${id}/applications`, { staleTime: 0 });
  const invalidate = useInvalidate();
  return (
    <Card className="p-4 md:p-5">
      <h2 className="mb-3 text-lg">Applicants</h2>
      <QueryBoundary query={q} skeleton={<ListSkeleton count={2} />}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState compact title="No applicants yet" description="People who apply will appear here with their profile and note." />
          ) : (
            <ul className="space-y-3">
              {rows.map((a) => (
                <ApplicantRow key={a.id} a={a} onChanged={() => void Promise.all([q.refetch(), invalidate("/work", "/my/work")])} />
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </Card>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm font-semibold">{children}</dd>
      </div>
    </div>
  );
}

function WorkDetail({ w }: { w: WorkOpportunityDTO }) {
  const [apply, setApply] = useState(false);
  const [edit, setEdit] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  const own = w.viewer.isOwn;
  const setStatus = async (status: "OPEN" | "CLOSED" | "FILLED") => {
    try {
      await api("POST", `/work/${w.id}/status`, { status });
      await invalidate("/work", "/my/work", "/opportunities");
      toast({ title: status === "OPEN" ? "Re-opened" : status === "FILLED" ? "Marked as filled" : "Closed" });
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-sm font-semibold text-primary hover:underline">
        ← Back
      </button>
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{WORK_KIND_LABEL[w.kind] ?? w.kind}</Badge>
          {w.professions.map((p) => (
            <Badge key={p.id} tone="neutral">
              {p.emoji} {p.name}
            </Badge>
          ))}
          {w.status !== "OPEN" && <Badge tone="warning">{w.status === "FILLED" ? "Filled" : "Closed"}</Badge>}
          {w.isDemo && <DemoBadge />}
        </div>
        <h1 className="mt-2 text-2xl md:text-3xl">{w.title}</h1>
        <p className="mt-1 text-lg font-extrabold text-primary">{w.payLabel}</p>
        {w.viewer.matchReasons.length > 0 && <p className="mt-2 inline-block rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary">Why you: {w.viewer.matchReasons.join(" · ")}</p>}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={MapPin} label="Where">
            {w.village && own ? `${w.village}, ` : ""}
            {w.district}, {w.state}
            {w.distanceKm != null && w.distanceKm > 0 && <span className="block text-xs font-normal text-muted-foreground">about {Math.round(w.distanceKm)} km from you</span>}
          </Fact>
          <Fact icon={CalendarDays} label="Starts">
            {w.startDate ? formatDate(w.startDate) : "Flexible"}
          </Fact>
          <Fact icon={Clock} label="Duration">
            {w.duration || "Not specified"}
          </Fact>
          <Fact icon={Users} label="People needed">
            {w.openings} · {w.mode === "REMOTE" ? "Remote" : "On site"}
          </Fact>
        </dl>
        <h2 className="mt-5 text-lg">About this work</h2>
        <p className="mt-1 whitespace-pre-line leading-relaxed">{w.description}</p>
        {w.skills.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold">Skills needed</p>
            <ul className="flex flex-wrap gap-1.5">
              {w.skills.map((s) => (
                <li key={s}>
                  <Badge tone="neutral">{s}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {w.contactPhone && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            <Phone className="h-4 w-4" aria-hidden /> Contact: {w.contactPhone}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
          <UserLine user={w.poster} sub={w.business ? `Posted for ${w.business.name}` : `Posted ${formatShortDate(w.createdAt)}`} className="flex-1" />
          <SaveButton targetType="WORK" targetId={w.id} saved={w.viewer.saved} className="rounded-xl border" label />
          <ShareButton title={w.title} path={`/opportunities/${w.id}`} className="rounded-xl border" />
          {!own && <ReportButton targetType="OPPORTUNITY" targetId={w.id} />}
          {own ? (
            <>
              <Button size="md" variant="outline" onClick={() => setEdit(true)}>
                Edit
              </Button>
              {w.status === "OPEN" ? (
                <>
                  <Button size="md" variant="outline" onClick={() => setStatus("FILLED")}>
                    Mark filled
                  </Button>
                  <Button size="md" variant="ghost" onClick={() => setStatus("CLOSED")}>
                    Close
                  </Button>
                </>
              ) : (
                <Button size="md" onClick={() => setStatus("OPEN")}>
                  Re-open
                </Button>
              )}
            </>
          ) : w.viewer.applied ? (
            <Badge tone={APP_TONE[(w.viewer.applicationStatus as keyof typeof APP_TONE) ?? "APPLIED"]}>You applied · {(w.viewer.applicationStatus ?? "APPLIED").toLowerCase()}</Badge>
          ) : w.viewer.canApply && w.status === "OPEN" ? (
            <Button size="lg" onClick={() => setApply(true)}>
              Apply now
            </Button>
          ) : null}
        </div>
        {!own && w.contactMethod === "PHONE" && !w.contactPhone && <p className="mt-3 text-xs text-muted-foreground">The poster shares their phone number only with applicants they accept.</p>}
      </Card>
      {!own && <Notice tone="warning">Never pay anyone to get work or share OTP, Aadhaar, bank or UPI details. KaamSetu does not take or hold payments — agree pay directly and keep it written down.</Notice>}
      {own && <Applicants id={w.id} />}
      {apply && <ApplySheet w={w} open={apply} onClose={() => setApply(false)} />}
      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit opportunity" size="lg">
        {edit && <OpportunityForm initial={w} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />}
      </Sheet>
    </div>
  );
}

export function WorkDetailView({ id }: { id: string }) {
  const q = useGet<WorkOpportunityDTO>(`/work/${id}`, { staleTime: 0 });
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={2} />}>
      {(w) => <WorkDetail w={w} />}
    </QueryBoundary>
  );
}

// ───────────── My work hub ─────────────
const REQ_TONE = { PENDING: "warning", ACCEPTED: "info", REJECTED: "danger", CANCELLED: "neutral", AWAITING_CONFIRMATION: "primary", COMPLETED: "success" } as const;
const REQ_LABEL = { PENDING: "Waiting for reply", ACCEPTED: "Accepted", REJECTED: "Declined", CANCELLED: "Cancelled", AWAITING_CONFIRMATION: "Waiting for confirmation", COMPLETED: "Completed" } as const;

function RequestRow({ r }: { r: ServiceRequestDTO }) {
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const provider = r.role === "PROVIDER";
  const other = provider ? r.requester : r.provider;
  const act = async (action: "ACCEPT" | "REJECT" | "CANCEL" | "MARK_DONE" | "CONFIRM_DONE") => {
    setBusy(true);
    try {
      await api("PATCH", `/service-requests/${r.id}`, { action });
      await invalidate("/my/work", "/service-requests", "/professionals", "/home");
      toast({ title: { ACCEPT: "Request accepted", REJECT: "Request declined", CANCEL: "Request cancelled", MARK_DONE: "Marked as done — waiting for confirmation", CONFIRM_DONE: "Job confirmed as done" }[action] });
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-xl border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {r.service.name} <span className="font-normal text-muted-foreground">· {r.service.priceLabel}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {provider ? "From" : "To"} <span className="font-semibold text-foreground">{other.name}</span> · {formatDate(r.date)} · {r.location.village ? `${r.location.village}, ` : ""}
            {r.location.district}
          </p>
        </div>
        <Badge tone={REQ_TONE[r.status]}>{REQ_LABEL[r.status]}</Badge>
      </div>
      <p className="mt-2 text-sm">{r.description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {r.conversationId && (
          <Button size="sm" variant="outline" onClick={() => router.push(`/messages?c=${r.conversationId}`)}>
            <MessageCircle className="h-4 w-4" /> Message
          </Button>
        )}
        {provider && r.status === "PENDING" && (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("REJECT")}>
              Decline
            </Button>
            <Button size="sm" disabled={busy} onClick={() => act("ACCEPT")}>
              Accept
            </Button>
          </>
        )}
        {provider && r.status === "ACCEPTED" && (
          <Button size="sm" disabled={busy} onClick={() => act("MARK_DONE")}>
            Mark as done
          </Button>
        )}
        {!provider && (r.status === "PENDING" || r.status === "ACCEPTED") && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("CANCEL")}>
            Cancel request
          </Button>
        )}
        {!provider && r.status === "AWAITING_CONFIRMATION" && (
          <Button size="sm" disabled={busy} onClick={() => act("CONFIRM_DONE")}>
            Confirm job is done
          </Button>
        )}
      </div>
    </li>
  );
}

function ApplicationRow({ a }: { a: ApplicationDTO }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5">
      <div>
        <Link href={`/opportunities/${a.opportunity.id}`} className="font-bold hover:underline">
          {a.opportunity.title}
        </Link>
        <p className="text-sm text-muted-foreground">Applied {formatShortDate(a.createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        {a.conversationId && (
          <ButtonLink href={`/messages?c=${a.conversationId}`} size="sm" variant="outline">
            <MessageCircle className="h-4 w-4" /> Message
          </ButtonLink>
        )}
        <Badge tone={APP_TONE[a.status]}>{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</Badge>
      </div>
    </li>
  );
}

type MyTab = "requests" | "services" | "posted" | "applications";

function MyWork({ d }: { d: MyWorkDTO }) {
  const [tab, setTab] = useState<MyTab>(d.requestsReceived.some((r) => r.status === "PENDING") || d.requestsReceived.length ? "requests" : d.opportunities.length ? "posted" : "services");
  const [sheet, setSheet] = useState<"service" | "opportunity" | null>(null);
  const { data: me } = useMe();
  const pendingIn = d.requestsReceived.filter((r) => r.status === "PENDING").length;
  return (
    <div>
      <PageHeader
        title="My work"
        subtitle="Service requests, your services, opportunities you posted and applications you sent — in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            {roleCan(me?.role, "service:manage") && (
              <Button size="sm" variant="outline" onClick={() => setSheet("service")}>
                <Plus className="h-4 w-4" /> Add a service
              </Button>
            )}
            {roleCan(me?.role, "work:post") && (
              <Button size="sm" onClick={() => setSheet("opportunity")}>
                <Plus className="h-4 w-4" /> Post an opportunity
              </Button>
            )}
          </div>
        }
      />
      <Tabs
        label="My work sections"
        value={tab}
        onChange={setTab}
        className="mb-4"
        items={[
          { id: "requests", label: "Requests", count: pendingIn || undefined },
          { id: "services", label: "My services", count: d.services.length || undefined },
          { id: "posted", label: "Posted", count: d.opportunities.length || undefined },
          { id: "applications", label: "Applications", count: d.applicationsSent.length || undefined },
        ]}
      />
      {tab === "requests" && (
        <div className="space-y-5">
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 text-lg">Requests for my services</h2>
            {d.requestsReceived.length === 0 ? <EmptyState compact title="No requests yet" description="When someone requests your service you will be notified here." /> : <ul className="space-y-3">{d.requestsReceived.map((r) => <RequestRow key={r.id} r={r} />)}</ul>}
          </Card>
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 text-lg">Requests I sent</h2>
            {d.requestsSent.length === 0 ? <EmptyState compact title="You haven't requested any service" action={{ label: "Find professionals", href: "/professionals" }} /> : <ul className="space-y-3">{d.requestsSent.map((r) => <RequestRow key={r.id} r={r} />)}</ul>}
          </Card>
        </div>
      )}
      {tab === "services" &&
        (d.services.length === 0 ? (
          <Card>
            <EmptyState title="You haven't listed a service" description="Services let people nearby request your work." action={{ label: "Add a service", onClick: () => setSheet("service") }} />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {d.services.map((s) => (
              <ServiceCard key={s.id} s={s} onEdit={() => setSheet("service")} />
            ))}
          </div>
        ))}
      {tab === "posted" &&
        (d.opportunities.length === 0 ? (
          <Card>
            <EmptyState title="You haven't posted an opportunity" description="Need someone for a job? Post it and get applications." action={{ label: "Post an opportunity", onClick: () => setSheet("opportunity") }} />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {d.opportunities.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </div>
        ))}
      {tab === "applications" && (
        <Card className="p-4 md:p-5">
          <h2 className="mb-3 text-lg">Applications I sent</h2>
          {d.applicationsSent.length === 0 ? <EmptyState compact title="No applications yet" action={{ label: "Browse work", href: "/opportunities?tab=work" }} /> : <ul className="space-y-3">{d.applicationsSent.map((a) => <ApplicationRow key={a.id} a={a} />)}</ul>}
        </Card>
      )}
      <Sheet open={sheet === "service"} onClose={() => setSheet(null)} title="Add a service">
        {sheet === "service" && <ServiceForm onDone={() => setSheet(null)} onCancel={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === "opportunity"} onClose={() => setSheet(null)} title="Post an opportunity" size="lg">
        {sheet === "opportunity" && <OpportunityForm onDone={() => setSheet(null)} onCancel={() => setSheet(null)} />}
      </Sheet>
    </div>
  );
}

export function MyWorkView() {
  const q = useGet<MyWorkDTO>("/my/work", { staleTime: 0 });
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(d) => <MyWork d={d} />}
    </QueryBoundary>
  );
}
