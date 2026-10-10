"use client";
import { ArrowRight, Briefcase, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Images, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Scene } from "@/components/art/scene";
import { useI18n } from "@/components/providers/i18n";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { QueryBoundary } from "@/components/ui/state";
import { ChipRow } from "@/components/ui/tabs";
import { useGet } from "@/hooks/use-api";
import { PRO_FEED_TOPICS } from "@/lib/constants";
import { sceneForProfession } from "@/lib/profession-scene";
import { formatDate, pluralize } from "@/lib/utils";
import type { ProfessionalHomeDTO } from "@/types/dto";
import { FeedList } from "./feed";
import { OpportunityStrip, QuickVoice } from "./home-parts";
import { ProfessionalCard, ReputationFacts, WorkCard } from "./pro-shared";
import { StoriesRow } from "./social";
import type { HomeDTO } from "@/types/dto";

interface TileSpec {
  key: string;
  label: string;
  icon: typeof Briefcase;
  href: string;
  value: (h: ProfessionalHomeDTO) => string;
  sub?: (h: ProfessionalHomeDTO) => string | undefined;
  tone: string;
}

const T = {
  work: (label: string): TileSpec => ({ key: "work", label, icon: Briefcase, href: "/opportunities?tab=work", value: (h) => (h.nearbyWork.length ? pluralize(h.nearbyWork.length, "opportunity", "opportunities") : "None right now"), sub: (h) => h.nearbyWork[0]?.title, tone: "bg-accent/14 text-accent" }),
  requests: (label: string): TileSpec => ({ key: "requests", label, icon: ClipboardList, href: "/my-work", value: (h) => (h.pendingRequests.length ? `${h.pendingRequests.length} waiting for you` : "No pending requests"), sub: (h) => (h.myServicesCount ? undefined : "List a service so people can request you"), tone: "bg-primary/12 text-primary" }),
  portfolio: (label: string): TileSpec => ({ key: "portfolio", label, icon: Images, href: "/profile", value: (h) => (h.portfolioCount ? pluralize(h.portfolioCount, "piece of work", "pieces of work") : "Nothing added yet"), sub: (h) => (h.portfolioCount ? undefined : "Photos of your work build trust"), tone: "bg-info/14 text-info" }),
  services: (label: string): TileSpec => ({ key: "services", label, icon: Wrench, href: "/my-work", value: (h) => (h.myServicesCount ? pluralize(h.myServicesCount, "service") : "None listed"), tone: "bg-info/14 text-info" }),
  events: (label: string): TileSpec => ({ key: "events", label, icon: CalendarDays, href: "/events", value: () => "See what is coming up", sub: () => "Fairs, camps and meetups", tone: "bg-warning/16 text-warning" }),
  learn: (name?: string): TileSpec => ({ key: "learn", label: name ? `${name} learning` : "Learning", icon: GraduationCap, href: "/learning", value: (h) => h.learning[0]?.title ?? "Browse courses", sub: (h) => (h.learning[0] ? undefined : "Free lessons for your trade"), tone: "bg-success/14 text-success" }),
};

/** What each dashboard type emphasises. Keyed by the catalog's `dashboard` value — not by individual professions. */
const DASHBOARD_TILES: Record<string, (name: string) => TileSpec[]> = {
  TRADE: (n) => [T.work("Nearby work"), T.requests("Service requests"), T.portfolio("Portfolio"), T.learn(n)],
  TECH: (n) => [T.work("Gigs & work nearby"), T.requests("Service requests"), T.portfolio("Portfolio"), T.learn(n)],
  ARTISAN: (n) => [T.requests("Orders & requests"), T.portfolio("Your portfolio"), T.events("Fairs & exhibitions"), T.learn(n)],
  SERVICE: (n) => [T.requests("Service requests"), T.work("Nearby work"), T.services("My services"), T.learn(n)],
  INDEPENDENT: (n) => [T.work("Projects & work"), T.requests("Requests"), T.portfolio("Portfolio"), T.learn(n)],
  AGRI_WORK: (n) => [T.work("Nearby farm work"), T.requests("Requests"), T.services("My services"), T.learn(n)],
  FARMER: (n) => [T.work("Nearby work"), T.requests("Requests"), T.portfolio("Portfolio"), T.learn(n)],
  GENERAL: (n) => [T.work("Nearby work"), T.requests("Requests"), T.portfolio("Portfolio"), T.learn(n)],
};

function Tile({ spec, h }: { spec: TileSpec; h: ProfessionalHomeDTO }) {
  const Icon = spec.icon;
  const sub = spec.sub?.(h);
  return (
    <Link href={spec.href} className="group flex flex-col rounded-2xl border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5">
      <span className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${spec.tone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{spec.label}</span>
      <span className="mt-0.5 line-clamp-2 text-base font-bold leading-snug">{spec.value(h)}</span>
      {sub && <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</span>}
    </Link>
  );
}

function Dashboard({ h, greetingName }: { h: ProfessionalHomeDTO; greetingName: string }) {
  const { t } = useI18n();
  const prof = h.profession;
  const tiles = (DASHBOARD_TILES[prof?.dashboard ?? "GENERAL"] ?? DASHBOARD_TILES.GENERAL!)(prof?.name ?? "");
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border shadow-card">
        <div className="absolute inset-0">
          <Scene kind={prof ? sceneForProfession(prof.id, prof.dashboard) : "sunrise"} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/70 to-background/10" />
        <div className="relative p-5 md:p-7">
          <p className="text-sm font-semibold text-muted-foreground">{formatDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5">
            {t("greeting.hello")}, {greetingName} 🙏
          </h1>
          <p className="mt-1.5 max-w-md text-foreground/85">{prof ? <>{prof.emoji} {prof.name} · here is your work today.</> : "Finish your profile to start getting work."}</p>
          {h.reputation && <ReputationFacts r={h.reputation} className="mt-2" />}
        </div>
      </div>

      <QuickVoice variant="pro" />

      {h.completeness.percent < 100 && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">Your profile is {h.completeness.percent}% complete</p>
            <Link href="/profile/edit" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Improve <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={h.completeness.percent} aria-label="Profile completeness">
            <div className="h-full rounded-full bg-primary" style={{ width: `${h.completeness.percent}%` }} />
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {h.completeness.missing.slice(0, 4).map((m) => (
              <li key={m.key}>
                <Link href={m.href} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-muted">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden /> {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="today">
        <SectionHeader title={t("section.todayWork")} />
        <h2 id="today" className="sr-only">
          {t("section.todayWork")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((s) => (
            <Tile key={s.key} spec={s} h={h} />
          ))}
        </div>
      </section>

      {h.pendingRequests.length > 0 && (
        <section>
          <SectionHeader title="Waiting for your reply" href="/my-work" />
          <ul className="space-y-2">
            {h.pendingRequests.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link href="/my-work" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3.5 shadow-card hover:bg-muted/50">
                  <span>
                    <span className="block font-bold">{r.service.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {r.requester.name} · {formatDate(r.date, { day: "numeric", month: "short" })} · {r.location.district}
                    </span>
                  </span>
                  <Badge tone="warning">Needs reply</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(h.nearbyWork.length > 0 || h.recommendedWork.length > 0) && (
        <section>
          <SectionHeader title={h.nearbyWork.length ? "Work near you" : "Work for you"} href="/opportunities?tab=work" />
          <div className="scroll-x -mx-4 px-4 pb-1 md:mx-0 md:px-0">
            {(h.nearbyWork.length ? h.nearbyWork : h.recommendedWork).slice(0, 6).map((w) => (
              <div key={w.id} className="w-80">
                <WorkCard w={w} />
              </div>
            ))}
          </div>
        </section>
      )}

      {h.nearbyProfessionals.length > 0 && (
        <section>
          <SectionHeader title="Professionals near you" href="/professionals" />
          <div className="scroll-x -mx-4 px-4 pb-1 md:mx-0 md:px-0">
            {h.nearbyProfessionals.slice(0, 6).map((p) => (
              <div key={p.user.id} className="w-80">
                <ProfessionalCard p={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {h.trendingProfessions.length > 0 && (
        <section>
          <SectionHeader title="Who works around you" />
          <ul className="flex flex-wrap gap-2">
            {h.trendingProfessions.map((p) => (
              <li key={p.id}>
                <Link href={`/professionals?profession=${p.id}`} className="tap inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
                  <span aria-hidden>{p.emoji}</span> {p.name} <span className="text-muted-foreground">· {p.count}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/professionals" className="tap inline-flex items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:underline">
                <Users className="h-4 w-4" aria-hidden /> See everyone
              </Link>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

export function ProfessionalHome() {
  const home = useGet<ProfessionalHomeDTO>("/home/professional");
  const base = useGet<HomeDTO>("/home");
  const [topic, setTopic] = useState<string>("ForYou");
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-8">
        <QueryBoundary query={home} skeleton={<ListSkeleton count={2} />}>
          {(h) => <Dashboard h={h} greetingName={base.data?.greetingName ?? ""} />}
        </QueryBoundary>
        {base.data && <StoriesRow stories={base.data.stories} />}
        <OpportunityStrip title="Training, programmes & events for you" />
        <section aria-labelledby="feed-h">
          <SectionHeader title="Your feed" />
          <h2 id="feed-h" className="sr-only">
            Your feed
          </h2>
          <ChipRow items={PRO_FEED_TOPICS.filter((x) => x !== "ForYou")} all="For you" value={topic === "ForYou" ? "" : topic} onChange={(v) => setTopic(v || "ForYou")} label="Feed topics" />
          <div className="mt-4">
            <FeedList topic={topic} />
          </div>
        </section>
      </div>
      <aside className="hidden space-y-4 lg:block">
        <Card className="p-4">
          <p className="mb-2 font-bold">Quick links</p>
          <ul className="space-y-1.5 text-sm font-semibold">
            {[
              ["/professionals", "Find professionals"],
              ["/opportunities?tab=work", "Browse work"],
              ["/create?type=opportunity", "Post an opportunity"],
              ["/create?type=service", "Add a service"],
              ["/schemes", "Government programmes"],
              ["/learning", "Open the Learning Hub"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="flex min-h-9 items-center justify-between rounded-lg px-2 hover:bg-muted">
                  {label} <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
