"use client";
import { Award, Calendar, Droplets, Globe2, Lock, MapPin, ShieldCheck, Sprout, Tractor, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScoreRing } from "@/components/art/charts";
import { Scene } from "@/components/art/scene";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, QueryBoundary } from "@/components/ui/state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Notice } from "@/components/ui/section";
import { useGet, useInfiniteList, flatten } from "@/hooks/use-api";
import { VISIBILITY_LABEL } from "@/lib/constants";
import { sceneForCrop } from "@/lib/crop-scene";
import { formatINR } from "@/lib/utils";
import type { CropDTO, FarmDTO, FarmerProfileDTO, ListingCardDTO, UserListItem } from "@/types/dto";
import { ListingCard } from "./cards";
import { FeedList } from "./feed";
import { UserLine } from "./people";
import { PersonActions, ProfileHeader, Section, TagList } from "./profile-parts";

const STATUS_TONE = { PLANNED: "neutral", GROWING: "success", HARVESTED: "accent", SOLD: "info" } as const;

export function CropRow({ c, link }: { c: CropDTO; link?: boolean }) {
  const inner = (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors hover:bg-muted/50">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        <Scene kind={sceneForCrop(c.name)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{c.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {c.season} · {c.areaAcres} acres · {c.method}
        </p>
      </div>
      <Badge tone={STATUS_TONE[c.status]}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
    </div>
  );
  return link ? <Link href={`/crops/${c.id}`}>{inner}</Link> : inner;
}

export function FarmCardMini({ f, link }: { f: FarmDTO; link?: boolean }) {
  const inner = (
    <Card className="overflow-hidden transition-transform hover:-translate-y-0.5">
      <div className="h-24">
        <Scene kind={f.scene} />
      </div>
      <div className="p-3.5">
        <p className="font-bold">{f.name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Tractor className="h-3.5 w-3.5" aria-hidden />
            {f.areaAcres} acres
          </span>
          <span>{f.soil}</span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5" aria-hidden />
            {f.irrigation}
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden />
          {f.village}, {f.district}
        </p>
      </div>
    </Card>
  );
  return link ? <Link href={`/farms/${f.id}`}>{inner}</Link> : inner;
}

function CropTimeline({ farms }: { farms: FarmDTO[] }) {
  const rows = farms.flatMap((f) => f.history.map((h) => ({ ...h, farm: f.name }))).sort((a, b) => b.year - a.year);
  if (!rows.length) return null;
  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-primary/25 pl-5">
      {rows.map((r, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.78rem] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" aria-hidden />
          <p className="text-sm font-bold text-primary">{r.year}</p>
          <p className="font-semibold">{r.crop}</p>
          <p className="text-sm text-muted-foreground">{r.farm}</p>
        </li>
      ))}
    </ol>
  );
}

export function Network({ id }: { id: string }) {
  const [type, setType] = useState<"followers" | "following">("followers");
  const q = useInfiniteList<UserListItem>(`/users/${id}/network`, { type });
  const rows = flatten(q.data);
  return (
    <Section title="Network">
      <Tabs
        label="Network"
        value={type}
        onChange={setType}
        items={[
          { id: "followers", label: "Followers" },
          { id: "following", label: "Following" },
        ]}
        className="mb-3"
      />
      {q.isLoading ? <ListSkeleton count={2} /> : rows.length === 0 ? <EmptyState compact title={type === "followers" ? "No followers yet" : "Not following anyone yet"} /> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.user.id} className="rounded-xl border p-2.5">
              <UserLine user={r.user} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Farms, crops and crop timeline — the farming extension of a professional profile. */
export function FarmerFarmsPanel({ p }: { p: FarmerProfileDTO }) {
  const self = p.viewer.isSelf;
  return (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Farms" action={self ? <Link href="/farms" className="text-sm font-semibold text-primary hover:underline">Manage</Link> : undefined}>
            {p.farms.length ? (
              <div className="grid gap-3">
                {p.farms.map((f) => (
                  <FarmCardMini key={f.id} f={f} link={self} />
                ))}
              </div>
            ) : (
              <EmptyState compact title="No farms shown" description={self ? "Add your first farm to start tracking." : "This farmer hasn't shared farm details."} action={self ? { label: "Add a farm", href: "/create?type=farm" } : undefined} />
            )}
          </Section>
          <div className="space-y-4">
            <Section title="Crops" action={self ? <Link href="/crops" className="text-sm font-semibold text-primary hover:underline">Manage</Link> : undefined}>
              {p.crops.length ? (
                <ul className="space-y-2">
                  {p.crops.map((c) => (
                    <li key={c.id}>
                      <CropRow c={c} link={self} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No crops yet" icon={<Sprout className="h-6 w-6" />} action={self ? { label: "Add a crop", href: "/create?type=crop" } : undefined} />
              )}
            </Section>
            {p.farms.some((f) => f.history.length) && (
              <Section title="Crop timeline">
                <CropTimeline farms={p.farms} />
              </Section>
            )}
          </div>
        </div>
  );
}

export function FarmerProducePanel({ p }: { p: FarmerProfileDTO }) {
  const self = p.viewer.isSelf;
  return p.produce.length ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {p.produce.map((l: ListingCardDTO) => (
        <ListingCard key={l.id} l={l} />
      ))}
    </div>
  ) : (
    <Card>
      <EmptyState title="No produce listed" description={self ? "List your harvest so buyers can find you." : "Nothing is listed publicly right now."} action={self ? { label: "List produce", href: "/create?type=produce" } : undefined} />
    </Card>
  );
}

type TabId = "about" | "farms" | "portfolio" | "produce" | "posts" | "network";

export function FarmerProfileBody({ p }: { p: FarmerProfileDTO }) {
  const [tab, setTab] = useState<TabId>("about");
  const self = p.viewer.isSelf;
  const items = [
    { id: "about" as const, label: "About" },
    { id: "farms" as const, label: "Farms & crops", count: p.crops.length || undefined },
    { id: "portfolio" as const, label: "Portfolio" },
    { id: "produce" as const, label: "Produce", count: p.produce.length || undefined },
    { id: "posts" as const, label: "Posts" },
    { id: "network" as const, label: "Network" },
  ];

  if (p.restricted) {
    return (
      <div className="space-y-4">
        <ProfileHeader user={p.user} scene="sunrise" subtitle={p.user.headline} location={p.district} isSelf={false} actions={<PersonActions user={p.user} following={p.viewer.isFollowing} connection={p.viewer.connection} />} />
        <Card className="p-8 text-center">
          <Lock className="mx-auto mb-3 h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="font-bold">This profile is private</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Connect with {p.user.name.split(" ")[0]} to see more about their farm and produce.</p>
        </Card>
      </div>
    );
  }

  const cover = p.farms[0]?.scene ?? sceneForCrop(p.crops[0]?.name);
  return (
    <div className="space-y-4">
      <ProfileHeader
        user={p.user}
        scene={cover}
        subtitle={p.user.headline ?? p.specialization}
        location={[p.village, p.district, p.state].filter(Boolean).join(", ")}
        isSelf={self}
        stats={[
          { label: "Followers", value: p.network.followers },
          { label: "Following", value: p.network.following },
          { label: "Connections", value: p.network.connections },
          { label: "Experience", value: `${p.experienceYears} yrs` },
        ]}
        extraBadges={p.network.fpos.map((f) => (
          <Link key={f.id} href={`/orgs/${f.userId}`}>
            <Badge tone="info">{f.name}</Badge>
          </Link>
        ))}
        actions={<PersonActions user={p.user} following={p.viewer.isFollowing} connection={p.viewer.connection} saved={p.viewer.saved} saveType="FARMER" />}
      />

      {self && p.privacy && (
        <Card className="flex flex-wrap items-center gap-3 p-3.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Your privacy:</strong> profile <em>{VISIBILITY_LABEL[p.privacy.profile]}</em> · income <em>{VISIBILITY_LABEL[p.privacy.income]}</em> · farm records <em>{VISIBILITY_LABEL[p.privacy.financialRecords]}</em> · phone <em>{VISIBILITY_LABEL[p.privacy.phone]}</em>
          </p>
          <Link href="/settings#privacy" className="text-sm font-semibold text-primary hover:underline">
            Change
          </Link>
        </Card>
      )}

      <Tabs label="Profile sections" items={items} value={tab} onChange={setTab} />

      {tab === "about" && (
        <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <Section title="Farming story">{p.story ? <p className="whitespace-pre-line leading-relaxed">{p.story}</p> : <p className="text-sm text-muted-foreground">No story yet.</p>}</Section>
            <Section title="Skills & expertise">
              <TagList items={p.skills} />
            </Section>
            <Section title="Certifications">
              {p.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">None added.</p>
              ) : (
                <ul className="space-y-2">
                  {p.certifications.map((c) => (
                    <li key={c.id} className="flex items-start gap-3">
                      <Award className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                      <span>
                        <span className="font-semibold">{c.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {c.issuer} · {c.year}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Achievements">
              {p.achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground">None added.</p>
              ) : (
                <ul className="space-y-3">
                  {p.achievements.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-highlight" aria-hidden />
                      <span>
                        <span className="font-semibold">
                          {a.title} <span className="font-normal text-muted-foreground">· {a.year}</span>
                        </span>
                        {a.description && <span className="block text-sm text-muted-foreground">{a.description}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
          <div className="space-y-4">
            <Section title="Details">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialisation</dt>
                  <dd>{p.specialization}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Farming since</dt>
                  <dd className="inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {p.farmingSince}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Methods</dt>
                  <dd className="mt-1">
                    <TagList items={p.methods} tone="success" />
                  </dd>
                </div>
                {p.livestock.length > 0 && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Livestock</dt>
                    <dd className="mt-1">
                      <TagList items={p.livestock} tone="accent" />
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Languages</dt>
                  <dd className="inline-flex items-center gap-1">
                    <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {p.languages.join(", ")}
                  </dd>
                </div>
                {p.phone && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</dt>
                    <dd>{p.phone}</dd>
                  </div>
                )}
              </dl>
            </Section>
            {p.health && (
              <Section title="Farm Health Score">
                <div className="flex items-center gap-4">
                  <ScoreRing score={p.health.score} label="Farm Health Score" size={88} />
                  <p className="text-sm text-muted-foreground">Completeness of farm records. Not a crop-condition rating.</p>
                </div>
              </Section>
            )}
            {p.financialSummary && (
              <Section title="Shared financial summary">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>Revenue (last year)</dt>
                    <dd className="font-bold">{formatINR(p.financialSummary.totalRevenueLastYear)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Avg. profit / acre</dt>
                    <dd className="font-bold">{formatINR(p.financialSummary.avgProfitPerAcre)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Shared by the farmer. Individual expenses and records stay private.</p>
              </Section>
            )}
            {!self && !p.financialSummary && (
              <Notice tone="info" title="Income & finances">
                Private by default. Farmers choose what to share.
              </Notice>
            )}
          </div>
        </div>
      )}

      {tab === "farms" && <FarmerFarmsPanel p={p} />}

      {tab === "portfolio" && (
        <div className="space-y-4">
          {p.portfolio.length === 0 ? (
            <Card>
              <EmptyState title="No portfolio items" description={self ? "Showcase your best seasons: crop, area, yield and method." : undefined} action={self ? { label: "Add to portfolio", href: "/profile/edit#portfolio" } : undefined} />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {p.portfolio.map((i) => (
                <Card key={i.id} className="overflow-hidden">
                  <div className="h-32">
                    <Scene kind={i.scene} />
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold text-primary">{i.year}</p>
                    <h3 className="text-base">{i.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {i.crop} · {i.areaAcres} acres · {i.method}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{i.yieldText}</p>
                    {i.description && <p className="mt-2 text-sm">{i.description}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {p.media.length > 0 && (
            <Section title="Photos & videos">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.media.map((m) => (
                  <li key={m.id}>
                    <div className="aspect-[4/3] overflow-hidden rounded-xl">
                      <Scene kind={m.scene} decorative={false} title={m.caption} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.caption}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {tab === "produce" && <FarmerProducePanel p={p} />}

      {tab === "posts" && <FeedList authorId={p.user.id} emptyAction={self ? { label: "Create a post", href: "/create?type=post" } : { label: "Back to Home", href: "/home" }} />}
      {tab === "network" && <Network id={p.user.id} />}
    </div>
  );
}

export function FarmerProfileView({ id }: { id: string }) {
  const q = useGet<FarmerProfileDTO>(`/farmers/${id}`);
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(p) => <FarmerProfileBody p={p} />}
    </QueryBoundary>
  );
}
