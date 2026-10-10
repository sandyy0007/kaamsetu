"use client";
import { AlertTriangle, ExternalLink, FileCheck2, Landmark, Phone, ShieldAlert, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Scene } from "@/components/art/scene";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { VerifiedMark } from "@/components/ui/avatar";
import { useGet } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { roleCan } from "@/lib/capabilities";
import { EMERGENCY_CONTACTS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { HealthDTO, OpportunityDTO, SchemeDTO } from "@/types/dto";
import { SaveButton, ShareButton } from "./actions";
import { OpportunityCard, SchemeCard } from "./cards";
import { SearchField, ToggleChip, useDebounced } from "./filters";
import { ChipRow } from "@/components/ui/tabs";
import { SCHEME_TOPICS } from "@/types/domain";

type Group = "all" | "schemes" | "subsidies" | "notifications" | "training" | "alerts";

export function SchemesView() {
  const me = useMe().data;
  const [group, setGroup] = useState<Group>("all");
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<"" | (typeof SCHEME_TOPICS)[number]>("");
  // Professionals see programmes for their own trade first; anyone can switch to the full list.
  const [forMe, setForMe] = useState<boolean | null>(null);
  const mineOnly = forMe ?? me?.role === "PROFESSIONAL";
  const dq = useDebounced(q.trim());
  const params = new URLSearchParams();
  if (group !== "all") params.set("group", group);
  if (dq) params.set("q", dq);
  if (topic) params.set("topic", topic);
  if (mineOnly) params.set("for", "me");
  const query = useGet<SchemeDTO[]>(`/schemes${params.size ? `?${params}` : ""}`, { keepPrevious: true });
  return (
    <div>
      <PageHeader
        title="Government hub"
        subtitle="Schemes, subsidies, skill development, employment, apprenticeship, worker-welfare and safety programmes — always with the official source."
        actions={me && roleCan(me.role, "scheme:publish") ? <ButtonLink href="/create?type=scheme">Publish update</ButtonLink> : undefined}
      />
      <Notice tone="warning" title="Demo content">
        Items marked DEMO are illustrative samples, not real schemes. Always confirm eligibility, dates and documents on the official government website before applying.
      </Notice>
      <div className="my-5 space-y-3">
        <SearchField value={q} onChange={setQ} label="Search schemes" placeholder="Search schemes, subsidies, training" />
        <Tabs label="Scheme type" value={group} onChange={setGroup} items={[{ id: "all", label: "All" }, { id: "schemes", label: "Schemes" }, { id: "subsidies", label: "Subsidies" }, { id: "notifications", label: "Notifications" }, { id: "training", label: "Training" }, { id: "alerts", label: "Alerts" }]} />
        <ChipRow label="Topic" items={SCHEME_TOPICS} value={topic} onChange={setTopic} all="All topics" />
        {me && (
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip on={mineOnly} onChange={setForMe}>
              Relevant to my profession
            </ToggleChip>
            <span className="text-xs text-muted-foreground">{mineOnly ? "Showing what matches your profession." : "Showing everything."}</span>
          </div>
        )}
      </div>
      {query.isLoading ? (
        <ListSkeleton count={4} />
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => void query.refetch()} /></Card>
      ) : !query.data?.length ? (
        <Card><EmptyState icon={<Landmark className="h-7 w-7" />} title="Nothing found" description="Try another search, topic or category — or switch off “Relevant to my profession”." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.map((s) => <SchemeCard key={s.id} s={s} />)}</div>
      )}
    </div>
  );
}

function ListBlock({ title, items, icon }: { title: string; items: string[]; icon?: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-base">{icon}{title}</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

export function SchemeDetail({ id }: { id: string }) {
  const q = useGet<SchemeDTO>(`/schemes/${id}`);
  if (q.isLoading) return <ListSkeleton count={2} />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Scheme not found" /></Card>;
  const s = q.data;
  const safeUrl = /^https?:\/\//i.test(s.officialSource) ? s.officialSource : null;
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/schemes" className="text-sm font-semibold text-primary hover:underline">← Government hub</Link>
      {s.isDemo && (
        <Notice tone="warning" title="DEMO content — not an official notice">
          This entry is a sample to show how the hub works. Do not rely on it for eligibility, benefits or deadlines. Check the official source before applying.
        </Notice>
      )}
      <Card className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5"><Badge tone="info">{s.category}</Badge><Badge tone="outline">{s.state}</Badge>{s.isDemo && <DemoBadge />}{s.daysLeft != null && s.daysLeft >= 0 && <Badge tone={s.daysLeft <= 14 ? "danger" : "warning"}>{s.daysLeft} days left</Badge>}</div>
          <h1 className="mt-2 text-2xl">{s.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Landmark className="h-4 w-4" aria-hidden /> {s.org.name}{s.org.verified && <VerifiedMark />}{s.org.department ? ` · ${s.org.department}` : ""}</p>
          {s.deadline && <p className="mt-1 text-sm text-muted-foreground">Deadline: <span className="font-semibold text-foreground">{formatDate(s.deadline)}</span></p>}
        </div>
        <p className="whitespace-pre-line">{s.description}</p>
        <ListBlock title="Who can apply" items={s.eligibility} icon={<FileCheck2 className="h-4 w-4 text-primary" />} />
        <ListBlock title="Benefits" items={s.benefits} />
        <ListBlock title="Documents usually needed" items={s.documents} />
        {s.applicationMethod && <section><h2 className="mb-1 text-base">How to apply</h2><p className="text-sm">{s.applicationMethod}</p></section>}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {safeUrl ? (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90">
              Official source <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : (
            <Badge tone="warning">No official link provided</Badge>
          )}
          <SaveButton targetType="SCHEME" targetId={s.id} saved={s.saved} label />
          <ShareButton title={s.name} path={`/schemes/${s.id}`} />
        </div>
      </Card>
    </div>
  );
}

// ───────── Health & safety ─────────
export function HealthView() {
  const q = useGet<HealthDTO[]>("/health");
  const [topic, setTopic] = useState("");
  const rows = (q.data ?? []).filter((h) => h.kind !== "CONTACT");
  const topics = [...new Set(rows.map((h) => h.topic))];
  const shown = rows.filter((h) => !topic || h.topic === topic);
  return (
    <div>
      <PageHeader title="Health & safety" subtitle="Practical safety guidance for farming families." />
      <Notice tone="danger" title="In an emergency, call 112 or 108 first">
        This section is general awareness information. KaamSetu and its AI assistant are not doctors and cannot diagnose or treat. For serious symptoms, snake-bite, poisoning or injury, get professional medical help immediately.
      </Notice>
      <section aria-label="Emergency contacts" className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EMERGENCY_CONTACTS.map((c) => (
          <a key={c.number} href={`tel:${c.number.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card transition-colors hover:bg-muted/60">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger"><Phone className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0"><span className="block text-lg font-extrabold tabular-nums">{c.number}</span><span className="block text-sm font-semibold">{c.name}</span><span className="block text-xs text-muted-foreground">{c.note}</span></span>
          </a>
        ))}
      </section>
      {q.isLoading ? (
        <ListSkeleton count={3} />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Health topics">
            {["", ...topics].map((t) => (
              <button key={t || "all"} onClick={() => setTopic(t)} aria-pressed={topic === t} className={`tap rounded-full border px-3.5 text-sm font-semibold transition-colors ${topic === t ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted"}`}>{t || "All topics"}</button>
            ))}
          </div>
          {!shown.length ? (
            <Card><EmptyState icon={<Stethoscope className="h-7 w-7" />} title="No guidance found" /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {shown.map((h) => (
                <Card key={h.id} className="overflow-hidden">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none gap-3 p-4 [&::-webkit-details-marker]:hidden">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl"><Scene kind={h.scene} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5"><Badge tone={h.emergency ? "danger" : "neutral"}>{h.topic}</Badge>{h.kind === "VIDEO" && <Badge tone="outline">Video</Badge>}</div>
                        <h2 className="mt-1 text-base">{h.title}</h2>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground group-open:line-clamp-none">{h.summary}</p>
                      </div>
                    </summary>
                    <div className="border-t bg-muted/30 p-4">
                      <ol className="list-decimal space-y-2 pl-5 text-sm">{h.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Awareness information only. If symptoms are serious or you are unsure, get professional medical care immediately.</p>
                    </div>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" aria-hidden /> Looking for crop or livestock advice? <Link className="font-semibold text-primary hover:underline" href="/experts">Ask an expert</Link>.</p>
    </div>
  );
}

// ───────── Opportunity Center ─────────
export function OpportunitiesView({ embedded = false }: { embedded?: boolean } = {}) {
  const q = useGet<OpportunityDTO[]>("/opportunities");
  const [kind, setKind] = useState("");
  const kinds = [...new Set((q.data ?? []).map((o) => o.kind))];
  const shown = (q.data ?? []).filter((o) => !kind || o.kind === kind);
  return (
    <div>
      {!embedded && <PageHeader title="Opportunity Center" subtitle="Work, schemes, training, buyers, machinery and events picked for your profession, place and profile." />}
      <Notice tone="info">Each card says why it was suggested. You can tune this in Settings → Personalisation.</Notice>
      <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Opportunity type">
        {["", ...kinds].map((k) => (
          <button key={k || "all"} onClick={() => setKind(k)} aria-pressed={kind === k} className={`tap rounded-full border px-3.5 text-sm font-semibold ${kind === k ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted"}`}>{k ? k.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "All"}</button>
        ))}
      </div>
      {q.isLoading ? <ListSkeleton count={4} /> : q.isError ? <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card> : !shown.length ? (
        <Card><EmptyState title="No opportunities yet" description="Add your skills, services and location to your profile to get relevant suggestions." action={{ label: "Complete profile", href: "/profile/edit" }} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((o) => <OpportunityCard key={o.id} o={o} />)}</div>
      )}
    </div>
  );
}
