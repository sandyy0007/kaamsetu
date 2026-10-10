"use client";
import { BadgeCheck, Building2, Globe, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { LoadMore } from "@/components/ui/load-more";
import { Notice, PageHeader } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, QueryBoundary } from "@/components/ui/state";
import { TagInput } from "@/components/ui/tag-input";
import { flatten, useGet, useInfiniteList, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { roleCan } from "@/lib/capabilities";
import { DISTRICT_NAMES } from "@/lib/geo";
import type { BusinessCardDTO, BusinessDetailDTO } from "@/types/dto";
import { ReportButton, ShareButton } from "./actions";
import { FilterPanel, SearchField, useDebounced } from "./filters";
import { BusinessForm } from "./pro-forms";
import { Chips, ProfessionalCard, ReputationFacts, ServiceCard, WorkCard, useCatalog } from "./pro-shared";
import { UserLine } from "./people";
import { Section } from "./profile-parts";

export function BusinessCard({ b }: { b: BusinessCardDTO }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary" aria-hidden>
          <Building2 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-1.5 text-base">
            <Link href={`/businesses/${b.id}`} className="hover:underline">
              {b.name}
            </Link>
            {b.verified && <BadgeCheck className="h-4 w-4 text-info" aria-label="Verified business" />}
            {b.isDemo && <DemoBadge />}
          </h2>
          <p className="text-sm text-muted-foreground">{b.kind}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{b.about}</p>
      <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" aria-hidden /> {b.district}, {b.state}
      </p>
      <div className="mt-2">
        <Chips items={b.services} max={4} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {b.openOpportunities > 0 ? <Badge tone="success">{b.openOpportunities} open {b.openOpportunities === 1 ? "opportunity" : "opportunities"}</Badge> : <span />}
        <Link href={`/businesses/${b.id}`} className="tap inline-flex items-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
          View
        </Link>
      </div>
    </Card>
  );
}

function BusinessesInner() {
  const sp = useSearchParams();
  const { data: me } = useMe();
  const { data: catalog } = useCatalog();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [district, setDistrict] = useState("");
  const [profession, setProfession] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const dq = useDebounced(q);
  const list = useInfiniteList<BusinessCardDTO>("/businesses", { q: dq, district, profession });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const active = [district, profession].filter(Boolean).length;
  return (
    <div>
      <PageHeader
        title="Businesses"
        subtitle="Workshops, contractors, shops, studios and cooperatives that offer services or hire."
        actions={
          roleCan(me?.role, "business:manage") ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add my business
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} label="Search businesses" placeholder="Search by name, service or place" />
        <FilterPanel
          activeCount={active}
          onClear={() => {
            setDistrict("");
            setProfession("");
          }}
        >
          <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Anywhere</option>
            {DISTRICT_NAMES.map((d) => (
              <option key={d}>{d}</option>
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
        </FilterPanel>
      </div>
      <div className="mt-5">
        {list.isLoading ? (
          <ListSkeleton count={3} />
        ) : list.isError ? (
          <Card>
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState icon={<Building2 className="h-7 w-7" />} title="No businesses found" description="Try another place or profession." />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <BusinessCard key={b.id} b={b} />
              ))}
            </div>
            <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
          </>
        )}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add your business" size="lg">
        {adding && (
          <BusinessForm
            onDone={(b) => {
              setAdding(false);
              router.push(`/businesses/${b.id}`);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </Sheet>
    </div>
  );
}

export function BusinessesView() {
  return (
    <Suspense>
      <BusinessesInner />
    </Suspense>
  );
}

// ───────────── detail ─────────────
function VerificationSheet({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<string[]>([]);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      await api("POST", `/businesses/${id}/verification`, { note, documentLabels: docs });
      toast({ title: "Verification requested", description: "An admin will review it. You'll be notified." });
      onClose();
    } catch (e) {
      setErr(e instanceof ApiClientError ? (Object.values(e.fields ?? {})[0] ?? e.message) : "Couldn't send the request");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Request business verification" description="A KaamSetu admin reviews this. Only list the kind of proof you can provide — don't upload or type any ID numbers here.">
      <div className="space-y-4">
        <Field label="Documents you can provide" required hint="e.g. Shop registration, GST certificate, trade licence" error={err}>
          {(a) => <TagInput id={a.id} value={docs} onChange={setDocs} max={6} placeholder="Press Enter after each" />}
        </Field>
        <Field label="Note for the reviewer" required>
          {(a) => <Textarea {...a} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send request
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function BusinessDetail({ b }: { b: BusinessDetailDTO }) {
  const [edit, setEdit] = useState(false);
  const [verify, setVerify] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  const remove = async () => {
    try {
      await api("DELETE", `/businesses/${b.id}`);
      await invalidate("/businesses", "/my/work");
      toast({ title: "Business removed" });
      router.push("/businesses");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't remove", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary" aria-hidden>
              <Building2 className="h-7 w-7" />
            </span>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl">
                {b.name}
                {b.verified && <Badge tone="info"><BadgeCheck className="h-3.5 w-3.5" /> Verified business</Badge>}
                {b.isDemo && <DemoBadge />}
              </h1>
              <p className="text-muted-foreground">{b.kind}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden /> {b.district}, {b.state}
                </span>
                {b.website && (
                  <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Globe className="h-4 w-4" aria-hidden /> Website
                  </a>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton title={b.name} path={`/businesses/${b.id}`} className="rounded-xl border" />
            {b.isOwn ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                  Edit
                </Button>
                {!b.verified && (
                  <Button size="sm" variant="outline" onClick={() => setVerify(true)}>
                    Request verification
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-danger" onClick={remove}>
                  Remove
                </Button>
              </>
            ) : (
              <ReportButton targetType="BUSINESS" targetId={b.id} />
            )}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-line leading-relaxed">{b.about}</p>
        {b.services.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-sm font-semibold">Services</p>
            <Chips items={b.services} max={20} tone="primary" />
          </div>
        )}
        <ReputationFacts r={b.reputation} className="mt-3" />
        <div className="mt-4 border-t pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
          <UserLine user={b.owner} />
        </div>
      </Card>

      {b.opportunities.length > 0 && (
        <Section title="Open opportunities">
          <div className="grid gap-4 md:grid-cols-2">
            {b.opportunities.map((w) => (
              <WorkCard key={w.id} w={w} />
            ))}
          </div>
        </Section>
      )}
      {b.services_offered.length > 0 && (
        <Section title="Services offered">
          <div className="grid gap-4 sm:grid-cols-2">
            {b.services_offered.map((s) => (
              <ServiceCard key={s.id} s={s} />
            ))}
          </div>
        </Section>
      )}
      {b.team.length > 0 && (
        <Section title="Team">
          <div className="grid gap-4 md:grid-cols-2">
            {b.team.map((p) => (
              <ProfessionalCard key={p.user.id} p={p} />
            ))}
          </div>
        </Section>
      )}
      {b.isOwn && !b.verified && <Notice tone="info">The verified badge is given only by KaamSetu admins after reviewing your documents. It can&apos;t be added by the business itself.</Notice>}
      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit business" size="lg">
        {edit && <BusinessForm initial={b} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} />}
      </Sheet>
      <VerificationSheet id={b.id} open={verify} onClose={() => setVerify(false)} />
    </div>
  );
}

export function BusinessDetailView({ id }: { id: string }) {
  const q = useGet<BusinessDetailDTO>(`/businesses/${id}`, { staleTime: 0 });
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={2} />}>
      {(b) => <BusinessDetail b={b} />}
    </QueryBoundary>
  );
}

