"use client";
import { Building2, Globe, MapPin, MessageSquare, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, QueryBoundary } from "@/components/ui/state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useGet, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import type { BuyerProfileDTO, ExpertProfileDTO, OrgProfileDTO } from "@/types/dto";
import { EventCard, ListingCard, QuestionCard, RequirementCard, SchemeCard } from "./cards";
import { PostCard } from "./social";
import { PersonActions, ProfileHeader, Section, TagList } from "./profile-parts";
import { UserLine } from "./people";
import type { SceneKind } from "@/types/domain";

export function BuyerProfileView({ id }: { id: string }) {
  const q = useGet<BuyerProfileDTO>(`/buyers/${id}`);
  const { data: me } = useMe();
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(b) => (
        <div className="space-y-4">
          <ProfileHeader
            user={b.user}
            scene="market"
            subtitle={`${b.businessName} · ${b.industry}`}
            location={`${b.district}, ${b.state}`}
            isSelf={b.viewer.isSelf}
            stats={[
              { label: "Followers", value: b.followers },
              { label: "Open needs", value: b.openRequirements },
            ]}
            actions={<PersonActions user={b.user} following={b.viewer.isFollowing} />}
          />
          <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              <Section title={`Current requirements (${b.requirements.length})`}>
                {b.requirements.length ? (
                  <div className="grid gap-3">
                    {b.requirements.map((r) => (
                      <RequirementCard key={r.id} r={r} canRespond={me?.role === "FARMER" || me?.role === "FPO"} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact title="No open requirements" description="Follow this buyer to hear when they post a new need." />
                )}
              </Section>
            </div>
            <div className="space-y-4">
              <Section title="About">
                <p className="text-sm leading-relaxed">{b.about}</p>
                {b.website && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-primary">
                    <Globe className="h-4 w-4" aria-hidden />
                    {b.website}
                  </p>
                )}
              </Section>
              <Section title="Buys">
                <TagList items={b.cropsPurchased} tone="accent" />
              </Section>
              <Section title="How to reach them">
                <ul className="space-y-1 text-sm">
                  {b.contactOptions.map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  Phone numbers are shared only if the buyer allows it. Never pay an advance to anyone you haven&apos;t verified.
                </p>
              </Section>
            </div>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

export function ExpertProfileView({ id }: { id: string }) {
  const q = useGet<ExpertProfileDTO>(`/experts/${id}`);
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(e) => (
        <div className="space-y-4">
          <ProfileHeader
            user={e.user}
            scene="classroom"
            subtitle={`${e.category} · ${e.qualification}`}
            location={`${e.organization} · ${e.district}, ${e.state}`}
            isSelf={e.viewer.isSelf}
            stats={[
              { label: "Followers", value: e.followers },
              { label: "Answers", value: e.answerCount },
              { label: "Experience", value: `${e.experienceYears} yrs` },
            ]}
            actions={
              <>
                <PersonActions user={e.user} following={e.viewer.isFollowing} />
                <ButtonLink href={`/experts?tab=questions&ask=1&expert=${e.user.id}`} variant="accent" size="md">
                  Ask a question
                </ButtonLink>
              </>
            }
          />
          <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              <Section title="Recent answers">
                {e.recentAnswers.length ? (
                  <div className="space-y-3">
                    {e.recentAnswers.map((r) => (
                      <QuestionCard key={r.question.id} q={r.question} />
                    ))}
                  </div>
                ) : (
                  <EmptyState compact title="No public answers yet" />
                )}
              </Section>
              {e.posts.length > 0 && (
                <section aria-label="Posts" className="space-y-3">
                  <h2 className="text-lg">Posts</h2>
                  {e.posts.map((p) => (
                    <PostCard key={p.id} post={p} compact />
                  ))}
                </section>
              )}
            </div>
            <div className="space-y-4">
              <Section title="About">
                <p className="text-sm leading-relaxed">{e.about}</p>
              </Section>
              <Section title="Specialisation">
                <TagList items={e.specialization} tone="success" />
              </Section>
              <Section title="Languages">
                <TagList items={e.languages} tone="neutral" />
              </Section>
            </div>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

type OrgTab = "about" | "posts" | "events" | "schemes" | "produce" | "members";

export function OrgProfileView({ id }: { id: string }) {
  const q = useGet<OrgProfileDTO>(`/orgs/${id}`);
  const [tab, setTab] = useState<OrgTab>("about");
  const toast = useToast();
  const join = useSend<void, unknown>("POST", `/fpo/${id}/join`, { invalidate: ["/orgs"], onSuccess: () => toast({ title: "Request sent" }) });
  const leave = useSend<void, unknown>("DELETE", `/fpo/${id}/join`, { invalidate: ["/orgs"], onSuccess: () => toast({ title: "You left the FPO" }) });
  const { data: me } = useMe();
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(o) => {
        const isFpo = o.kind === "FPO";
        const scene: SceneKind = isFpo ? "dairy" : "sunrise";
        const tabs: { id: OrgTab; label: string; count?: number }[] = [
          { id: "about", label: "About" },
          { id: "posts", label: "Posts", count: o.posts.length || undefined },
          { id: "events", label: "Events", count: o.events.length || undefined },
          ...(isFpo ? [{ id: "produce" as const, label: "Produce", count: o.listings.length || undefined }, { id: "members" as const, label: "Members", count: o.members.length || undefined }] : [{ id: "schemes" as const, label: "Schemes", count: o.schemes.length || undefined }]),
        ];
        return (
          <div className="space-y-4">
            <ProfileHeader
              user={o.user}
              scene={scene}
              subtitle={isFpo ? "FPO / Co-operative" : (o.department ?? "Government / Organisation")}
              location={[o.district, o.state].filter(Boolean).join(", ")}
              isSelf={o.viewer.isSelf}
              stats={[
                { label: "Followers", value: o.followers },
                ...(o.memberCount != null ? [{ label: "Members", value: o.memberCount }] : []),
              ]}
              actions={
                <>
                  <PersonActions user={o.user} following={o.viewer.isFollowing} />
                  {isFpo && me?.role === "FARMER" &&
                    (o.viewer.isMember ? (
                      <Button variant="outline" size="md" onClick={() => leave.mutate()} loading={leave.isPending}>
                        Leave FPO
                      </Button>
                    ) : (
                      <Button size="md" variant="accent" onClick={() => join.mutate()} loading={join.isPending}>
                        Request to join
                      </Button>
                    ))}
                </>
              }
            />
            <Tabs label="Organisation sections" items={tabs} value={tab} onChange={setTab} />
            {tab === "about" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="About">
                  <p className="leading-relaxed">{o.about}</p>
                  {o.website && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-primary">
                      <Globe className="h-4 w-4" aria-hidden />
                      {o.website}
                    </p>
                  )}
                </Section>
                <Section title="Focus">
                  <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {[o.district, o.state].filter(Boolean).join(", ")}
                  </p>
                  {o.crops?.length ? <TagList items={o.crops} /> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" /> {o.department ?? "Public information and programmes"}</p>}
                  {o.user.isDemo && !isFpo && <Badge tone="warning" className="mt-3">DEMO organisation — not a real government body</Badge>}
                </Section>
              </div>
            )}
            {tab === "posts" && (o.posts.length ? <div className="space-y-4">{o.posts.map((p) => <PostCard key={p.id} post={p} compact />)}</div> : <Card><EmptyState title="No posts yet" /></Card>)}
            {tab === "events" && (o.events.length ? <div className="grid gap-3 md:grid-cols-2">{o.events.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Card><EmptyState title="No upcoming events" /></Card>)}
            {tab === "schemes" && (o.schemes.length ? <div className="grid gap-3 md:grid-cols-2">{o.schemes.map((s) => <SchemeCard key={s.id} s={s} />)}</div> : <Card><EmptyState title="No schemes published" /></Card>)}
            {tab === "produce" && (o.listings.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{o.listings.map((l) => <ListingCard key={l.id} l={l} />)}</div> : <Card><EmptyState title="No aggregated lots listed" /></Card>)}
            {tab === "members" && (
              <Section title="Member farmers">
                {o.members.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {o.members.map((m) => (
                      <li key={m.user.id} className="rounded-xl border p-2.5">
                        <UserLine user={m.user} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="No members yet" />
                )}
              </Section>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

