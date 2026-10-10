"use client";
import { Check, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/providers/toast";
import { Scene } from "@/components/art/scene";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useGet, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { roleCan } from "@/lib/capabilities";
import { pluralize } from "@/lib/utils";
import type { CommunityDTO } from "@/types/dto";
import { CommunityCard } from "./cards";
import { FeedList } from "./feed";
import { SearchField, useDebounced } from "./filters";

type View = "all" | "joined";

const KIND_FILTERS = [
  { id: "PROFESSION", label: "By profession" },
  { id: "LOCATION", label: "By place" },
  { id: "CROP", label: "Crops" },
  { id: "METHOD", label: "Methods" },
  { id: "LIVESTOCK", label: "Livestock" },
  { id: "MACHINERY", label: "Machinery" },
] as const;

export function CommunitiesView() {
  const me = useMe().data;
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | (typeof KIND_FILTERS)[number]["id"]>("");
  const dq = useDebounced(q.trim(), 300);
  const params = new URLSearchParams();
  if (dq) params.set("q", dq);
  if (kind) params.set("kind", kind);
  if (view === "joined") params.set("joined", "1");
  const query = useGet<CommunityDTO[]>(`/communities${params.size ? `?${params}` : ""}`, { keepPrevious: true });
  return (
    <div>
      <PageHeader
        title="Communities"
        subtitle="Groups by profession, place, crop and method — ask, share and learn together."
        actions={me && roleCan(me.role, "community:create") ? <ButtonLink href="/create?type=community"><Plus className="h-4 w-4" /> New community</ButtonLink> : undefined}
      />
      <div className="mb-5 space-y-3">
        <SearchField value={q} onChange={setQ} label="Search communities" placeholder="Search communities" />
        <Tabs label="Community filter" value={view} onChange={setView} items={[{ id: "all", label: "All communities" }, { id: "joined", label: "My communities" }]} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Community type">
          {[{ id: "" as const, label: "All types" }, ...KIND_FILTERS].map((k) => (
            <button key={k.id || "all"} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={`tap rounded-full border px-3.5 text-sm font-semibold ${kind === k.id ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted"}`}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <ListSkeleton count={4} />
      ) : query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => void query.refetch()} /></Card>
      ) : !query.data?.length ? (
        <Card>
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title={view === "joined" ? "You haven't joined any community" : "No communities match"}
            description={view === "joined" ? "Join a community to see its posts in your feed." : "Try a different search."}
            action={view === "joined" ? { label: "Browse all", onClick: () => setView("all") } : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((c) => (
            <CommunityCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommunityDetail({ id }: { id: string }) {
  const me = useMe().data;
  const toast = useToast();
  const q = useGet<CommunityDTO>(`/communities/${id}`);
  const join = useSend<void, CommunityDTO>("POST", `/communities/${id}/join`, {
    invalidate: ["/communities", "/feed", "/home"],
    onSuccess: () => toast({ title: "Joined community" }),
    onError: (e) => toast({ kind: "error", title: "Couldn't join", description: e.message }),
  });
  const leave = useSend<void, CommunityDTO>("DELETE", `/communities/${id}/join`, {
    invalidate: ["/communities", "/feed", "/home"],
    onSuccess: () => toast({ title: "Left community" }),
    onError: (e) => toast({ kind: "error", title: "Couldn't leave", description: e.message }),
  });
  if (q.isLoading) return <ListSkeleton count={3} media />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Community not found" /></Card>;
  const c = q.data;
  const canJoin = !!me && roleCan(me.role, "community:join");
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative h-32 sm:h-44">
          <Scene kind={c.scene} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 text-white">
            <Badge tone="neutral">{c.kind}</Badge>
            {c.isModerator && <Badge tone="info"><ShieldCheck className="h-3 w-3" aria-hidden /> Moderator</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl">{c.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.description}</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {pluralize(c.memberCount, "member")} · {pluralize(c.postCount, "post")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {c.joined ? (
              <>
                <ButtonLink href={`/create?type=post&community=${c.id}`}><Plus className="h-4 w-4" /> Post</ButtonLink>
                <Button variant="outline" loading={leave.isPending} onClick={() => leave.mutate()} aria-label={`Leave ${c.name}`}>
                  <LogOut className="h-4 w-4" /> Leave
                </Button>
              </>
            ) : canJoin ? (
              <Button loading={join.isPending} onClick={() => join.mutate()}>
                <Check className="h-4 w-4" /> Join community
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Your account type can read this community but not join it.</p>
            )}
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Community posts">
          <FeedList communityId={c.id} emptyAction={c.joined ? { label: "Write the first post", href: `/create?type=post&community=${c.id}` } : undefined} />
        </section>
        <aside className="space-y-4 lg:order-last">
          <Card className="p-4">
            <h2 className="text-base">Community rules</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {c.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </Card>
          <Link href="/communities" className="inline-block text-sm font-semibold text-primary hover:underline">
            ← All communities
          </Link>
        </aside>
      </div>
    </div>
  );
}
