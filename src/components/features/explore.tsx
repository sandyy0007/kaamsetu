"use client";
import { Briefcase, Compass, GraduationCap, Search, UserCog, UsersRound, CalendarDays, Award } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { PageHeader, SectionHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useGet } from "@/hooks/use-api";
import { withQuery } from "@/lib/api";
import type { BuyerCardDTO, ExpertCardDTO, FarmerCardDTO, OpportunityDTO, ProfessionalCardDTO, ReelDTO, SearchResultsDTO, EventDTO } from "@/types/dto";
import { CommunityCard, CourseCard, EventCard, ListingCard, OpportunityCard, SchemeCard } from "./cards";
import { SearchField, useDebounced } from "./filters";
import { BuyerCard, ExpertCard, FarmerCard, OrgCard } from "./people";
import { BusinessCard } from "./businesses";
import { ProfessionalCard, ServiceCard, WorkCard } from "./pro-shared";
import { PostCard, ReelThumb } from "./social";

const EXAMPLES = ["Electrician near Churu", "Carpenter", "Tailor", "Mustard farmers near Churu", "Driver for hire", "Skill training", "सरसों किसान"];

type Tab = "all" | "professionals" | "services" | "opportunities" | "businesses" | "farmers" | "buyers" | "experts" | "orgs" | "produce" | "posts" | "reels" | "events" | "schemes" | "courses" | "communities";
const TAB_LABEL: Record<Tab, string> = { all: "All", professionals: "Professionals", services: "Services", opportunities: "Work", businesses: "Businesses", farmers: "Farmers", buyers: "Buyers", experts: "Experts", orgs: "Orgs & FPOs", produce: "Produce", posts: "Posts", reels: "Reels", events: "Events", schemes: "Schemes", courses: "Courses", communities: "Communities" };

function Results({ r, tab }: { r: SearchResultsDTO; tab: Tab }) {
  const grid = (children: React.ReactNode, cols = "md:grid-cols-2 xl:grid-cols-3") => <div className={`grid gap-4 ${cols}`}>{children}</div>;
  const show = (t: Tab) => tab === "all" || tab === t;
  const cap = (arr: unknown[]) => (tab === "all" ? 3 : arr.length);
  return (
    <div className="space-y-8">
      {show("professionals") && r.professionals.length > 0 && (
        <section>
          <SectionHeader title={`Professionals (${r.counts.professionals ?? r.professionals.length})`} href={tab === "all" ? `/professionals?q=${encodeURIComponent(r.q)}` : undefined} />
          {grid(r.professionals.slice(0, cap(r.professionals)).map((p) => <ProfessionalCard key={p.user.id} p={p} />))}
        </section>
      )}
      {show("services") && r.services.length > 0 && (
        <section>
          <SectionHeader title={`Services (${r.counts.services ?? r.services.length})`} />
          {grid(r.services.slice(0, cap(r.services)).map((x) => <ServiceCard key={x.id} s={x} />))}
        </section>
      )}
      {show("opportunities") && r.opportunities.length > 0 && (
        <section>
          <SectionHeader title={`Work & opportunities (${r.counts.opportunities ?? r.opportunities.length})`} href={tab === "all" ? `/opportunities?tab=work&q=${encodeURIComponent(r.q)}` : undefined} />
          {grid(r.opportunities.slice(0, cap(r.opportunities)).map((w) => <WorkCard key={w.id} w={w} />))}
        </section>
      )}
      {show("businesses") && r.businesses.length > 0 && (
        <section>
          <SectionHeader title={`Businesses (${r.counts.businesses ?? r.businesses.length})`} href={tab === "all" ? `/businesses?q=${encodeURIComponent(r.q)}` : undefined} />
          {grid(r.businesses.slice(0, cap(r.businesses)).map((b) => <BusinessCard key={b.id} b={b} />))}
        </section>
      )}
      {show("farmers") && r.farmers.length > 0 && (
        <section>
          <SectionHeader title={`Farmers (${r.counts.farmers ?? r.farmers.length})`} href={tab === "all" ? `/farmers?q=${encodeURIComponent(r.q)}` : undefined} />
          {grid(r.farmers.slice(0, cap(r.farmers)).map((f: FarmerCardDTO) => <FarmerCard key={f.user.id} f={f} />))}
        </section>
      )}
      {show("produce") && r.produce.length > 0 && (
        <section>
          <SectionHeader title={`Produce (${r.counts.produce ?? r.produce.length})`} href={tab === "all" ? `/market?q=${encodeURIComponent(r.q)}` : undefined} />
          {grid(r.produce.slice(0, cap(r.produce)).map((l) => <ListingCard key={l.id} l={l} />))}
        </section>
      )}
      {show("buyers") && r.buyers.length > 0 && (
        <section>
          <SectionHeader title={`Buyers (${r.counts.buyers ?? r.buyers.length})`} />
          {grid(r.buyers.slice(0, cap(r.buyers)).map((b: BuyerCardDTO) => <BuyerCard key={b.user.id} b={b} />))}
        </section>
      )}
      {show("experts") && r.experts.length > 0 && (
        <section>
          <SectionHeader title={`Experts (${r.counts.experts ?? r.experts.length})`} />
          {grid(r.experts.slice(0, cap(r.experts)).map((e: ExpertCardDTO) => <ExpertCard key={e.user.id} e={e} />))}
        </section>
      )}
      {show("orgs") && r.orgs.length > 0 && (
        <section>
          <SectionHeader title={`Organisations & FPOs (${r.counts.orgs ?? r.orgs.length})`} />
          {grid(r.orgs.slice(0, cap(r.orgs)).map((o) => <OrgCard key={o.user.id} o={o} />))}
        </section>
      )}
      {show("events") && r.events.length > 0 && (
        <section>
          <SectionHeader title={`Events (${r.counts.events ?? r.events.length})`} href={tab === "all" ? "/events" : undefined} />
          {grid(r.events.slice(0, cap(r.events)).map((e) => <EventCard key={e.id} e={e} />), "md:grid-cols-2")}
        </section>
      )}
      {show("schemes") && r.schemes.length > 0 && (
        <section>
          <SectionHeader title={`Government schemes (${r.counts.schemes ?? r.schemes.length})`} href={tab === "all" ? "/schemes" : undefined} />
          {grid(r.schemes.slice(0, cap(r.schemes)).map((s) => <SchemeCard key={s.id} s={s} />))}
        </section>
      )}
      {show("courses") && r.courses.length > 0 && (
        <section>
          <SectionHeader title={`Courses (${r.counts.courses ?? r.courses.length})`} href={tab === "all" ? "/learning" : undefined} />
          {grid(r.courses.slice(0, cap(r.courses)).map((c) => <CourseCard key={c.id} c={c} />))}
        </section>
      )}
      {show("communities") && r.communities.length > 0 && (
        <section>
          <SectionHeader title={`Communities (${r.counts.communities ?? r.communities.length})`} />
          {grid(r.communities.slice(0, cap(r.communities)).map((c) => <CommunityCard key={c.id} c={c} />), "md:grid-cols-2")}
        </section>
      )}
      {show("reels") && r.reels.length > 0 && (
        <section>
          <SectionHeader title={`Reels (${r.counts.reels ?? r.reels.length})`} href={tab === "all" ? "/reels" : undefined} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {r.reels.slice(0, tab === "all" ? 5 : r.reels.length).map((x: ReelDTO) => (
              <ReelThumb key={x.id} reel={x} />
            ))}
          </div>
        </section>
      )}
      {show("posts") && r.posts.length > 0 && (
        <section className="max-w-2xl">
          <SectionHeader title={`Posts (${r.counts.posts ?? r.posts.length})`} />
          <div className="space-y-4">
            {r.posts.slice(0, cap(r.posts)).map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const HUB = [
  { href: "/professionals", label: "Professionals", desc: "Find skilled people", icon: UsersRound },
  { href: "/opportunities?tab=work", label: "Work", desc: "Jobs, gigs, contracts", icon: Briefcase },
  { href: "/communities", label: "Communities", desc: "By trade and place", icon: UsersRound },
  { href: "/events", label: "Events", desc: "Camps, fairs, meetups", icon: CalendarDays },
  { href: "/experts", label: "Experts", desc: "Ask and learn", icon: Award },
  { href: "/learning", label: "Learning", desc: "Free courses", icon: GraduationCap },
  { href: "/businesses", label: "Businesses", desc: "Shops and contractors", icon: UserCog },
] as const;

function Discover() {
  const pros = useGet<{ items: ProfessionalCardDTO[] }>("/professionals?limit=3");
  const experts = useGet<{ items: ExpertCardDTO[] }>("/experts?limit=3");
  const reels = useGet<{ items: ReelDTO[] }>("/reels");
  const events = useGet<EventDTO[] | { items: EventDTO[] }>("/events");
  const opps = useGet<OpportunityDTO[]>("/opportunities");
  const eventItems = useMemo(() => {
    const d = events.data;
    return d ? (Array.isArray(d) ? d : d.items) : [];
  }, [events.data]);
  return (
    <div className="space-y-8">
      <section aria-label="Explore sections">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {HUB.map((h) => (
            <li key={h.href}>
              <Link href={h.href} className="flex h-full flex-col items-start gap-1 rounded-2xl border bg-card p-3.5 shadow-card transition-transform hover:-translate-y-0.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">
                  <h.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-bold leading-tight">{h.label}</span>
                <span className="text-xs text-muted-foreground">{h.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {reels.data && reels.data.items.length > 0 && (
        <section>
          <SectionHeader title="Trending reels" href="/reels" />
          <div className="scroll-x -mx-4 px-4 md:mx-0 md:px-0">
            {reels.data.items.map((r) => (
              <div key={r.id} className="w-36">
                <ReelThumb reel={r} />
              </div>
            ))}
          </div>
        </section>
      )}
      {opps.data && opps.data.length > 0 && (
        <section>
          <SectionHeader title="Recommended for you" href="/opportunities" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {opps.data.slice(0, 3).map((o) => (
              <OpportunityCard key={o.id} o={o} />
            ))}
          </div>
        </section>
      )}
      {pros.data && pros.data.items.length > 0 && (
        <section>
          <SectionHeader title="Professionals to follow" href="/professionals" />
          <div className="grid gap-4 md:grid-cols-3">
            {pros.data.items.map((p) => (
              <ProfessionalCard key={p.user.id} p={p} />
            ))}
          </div>
        </section>
      )}
      {experts.data && (
        <section>
          <SectionHeader title="Experts" href="/experts" />
          <div className="grid gap-4 md:grid-cols-3">
            {experts.data.items.map((e) => (
              <ExpertCard key={e.user.id} e={e} />
            ))}
          </div>
        </section>
      )}
      {eventItems.length > 0 && (
        <section>
          <SectionHeader title="Upcoming events" href="/events" />
          <div className="grid gap-3 md:grid-cols-2">
            {eventItems.slice(0, 4).map((e) => (
              <EventCard key={e.id} e={e} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ExploreView() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q.trim(), 350);
  const [tab, setTab] = useState<Tab>("all");
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);
  useEffect(() => {
    router.replace(dq ? `/explore?q=${encodeURIComponent(dq)}` : "/explore", { scroll: false });
  }, [dq, router]);
  const search = useGet<SearchResultsDTO>(dq.length >= 2 ? withQuery("/search", { q: dq }) : null, { keepPrevious: true });
  const tabs = useMemo(() => {
    if (!search.data) return [];
    const c = search.data.counts;
    return (Object.keys(TAB_LABEL) as Tab[]).filter((t) => t === "all" || (c[t] ?? 0) > 0).map((t) => ({ id: t, label: TAB_LABEL[t], count: t === "all" ? undefined : c[t] }));
  }, [search.data]);
  const total = search.data ? Object.values(search.data.counts).reduce((s, n) => s + n, 0) : 0;
  return (
    <div>
      <PageHeader title="Explore" subtitle="Search professionals, work, services, farmers, experts, schemes, events and more." />
      <SearchField value={q} onChange={setQ} label="Search KaamSetu" placeholder="Try “Electrician near Churu”" />
      {!dq && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Example searches">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => setQ(e)} className="tap inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <Search className="h-3.5 w-3.5 text-muted-foreground" /> {e}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6">
        {!dq || dq.length < 2 ? (
          <Discover />
        ) : search.isLoading ? (
          <ListSkeleton count={3} />
        ) : search.isError ? (
          <Card>
            <ErrorState error={search.error} onRetry={() => void search.refetch()} />
          </Card>
        ) : total === 0 ? (
          <Card>
            <EmptyState icon={<Compass className="h-7 w-7" />} title={`Nothing found for “${dq}”`} description="Check the spelling, or try a profession or skill with a district — for example “carpenter Sikar”." />
          </Card>
        ) : (
          <>
            <Tabs label="Result types" value={tab} onChange={setTab} items={tabs} className="mb-5" />
            <p className="sr-only" aria-live="polite">
              {total} results
            </p>
            {search.data && <Results r={search.data} tab={tab} />}
          </>
        )}
      </div>
    </div>
  );
}

export function SavedView() {
  const q = useGet<{ posts: import("@/types/dto").PostDTO[]; reels: ReelDTO[]; listings: import("@/types/dto").ListingCardDTO[]; schemes: import("@/types/dto").SchemeDTO[]; events: EventDTO[]; farmers: FarmerCardDTO[] }>("/saved", { staleTime: 0 });
  const [tab, setTab] = useState<"posts" | "listings" | "schemes" | "events" | "farmers" | "reels">("posts");
  const d = q.data;
  const items = [
    { id: "posts" as const, label: "Posts", count: d?.posts.length },
    { id: "reels" as const, label: "Reels", count: d?.reels.length },
    { id: "listings" as const, label: "Produce", count: d?.listings.length },
    { id: "schemes" as const, label: "Schemes", count: d?.schemes.length },
    { id: "events" as const, label: "Events", count: d?.events.length },
    { id: "farmers" as const, label: "Farmers", count: d?.farmers.length },
  ];
  return (
    <div>
      <PageHeader title="Saved" subtitle="Things you bookmarked — only you can see this." />
      <Tabs label="Saved types" value={tab} onChange={setTab} items={items} className="mb-5" />
      {q.isLoading ? (
        <ListSkeleton count={2} />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>
      ) : d && d[tab].length === 0 ? (
        <Card>
          <EmptyState title={`No saved ${tab}`} description="Tap the bookmark icon on anything to keep it here." action={{ label: "Explore", href: "/explore" }} />
        </Card>
      ) : d ? (
        <div className={tab === "posts" ? "max-w-2xl space-y-4" : tab === "reels" ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
          {tab === "posts" && d.posts.map((p) => <PostCard key={p.id} post={p} />)}
          {tab === "reels" && d.reels.map((r) => <ReelThumb key={r.id} reel={r} />)}
          {tab === "listings" && d.listings.map((l) => <ListingCard key={l.id} l={l} />)}
          {tab === "schemes" && d.schemes.map((s) => <SchemeCard key={s.id} s={s} />)}
          {tab === "events" && d.events.map((e) => <EventCard key={e.id} e={e} />)}
          {tab === "farmers" && d.farmers.map((f) => <FarmerCard key={f.user.id} f={f} />)}
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/explore" className="font-semibold text-primary hover:underline">Discover more</Link> to save things for later.
      </p>
    </div>
  );
}
