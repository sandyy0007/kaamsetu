"use client";
import { ArrowRight, Calendar, GraduationCap, Landmark, Mic, Sprout, Store, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScoreRing } from "@/components/art/charts";
import { Scene } from "@/components/art/scene";
import { useI18n } from "@/components/providers/i18n";
import { Card } from "@/components/ui/card";
import { QueryBoundary } from "@/components/ui/state";
import { SectionHeader } from "@/components/ui/section";
import { ChipRow } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useGet } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { FEED_TOPICS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import type { HomeDTO } from "@/types/dto";
import { FeedList } from "./feed";
import { OpportunityStrip, QuickVoice } from "./home-parts";
import { ProfessionalHome } from "./professional-home";
import { StoriesRow } from "./social";

function Tile({ href, icon: Icon, label, value, sub, tone }: { href: string; icon: typeof Sprout; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-2xl border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5">
      <span className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${tone ?? "bg-primary/12 text-primary"}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 line-clamp-2 text-base font-bold leading-snug">{value}</span>
      {sub && <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</span>}
    </Link>
  );
}

function Dashboard({ h }: { h: HomeDTO }) {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border shadow-card">
        <div className="absolute inset-0">
          <Scene kind={h.currentCrop ? (h.currentCrop.name.toLowerCase().includes("wheat") ? "wheat" : h.currentCrop.name.toLowerCase().includes("bajra") ? "bajra" : "mustard") : "sunrise"} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/70 to-background/10" />
        <div className="relative p-5 md:p-7">
          <p className="text-sm font-semibold text-muted-foreground">{formatDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5">
            {t("greeting.hello")}, {h.greetingName} 🙏
          </h1>
          {h.currentCrop ? (
            <p className="mt-1.5 max-w-md text-foreground/85">
              {lang === "en" ? "Your " : ""}
              <Link href={`/crops/${h.currentCrop.cropId}`} className="font-bold text-primary hover:underline">
                {h.currentCrop.name}
              </Link>{" "}
              {lang === "hi" ? `${h.currentCrop.areaAcres} एकड़ — चरण:` : lang === "hinglish" ? `${h.currentCrop.areaAcres} acre — stage:` : `on ${h.currentCrop.areaAcres} acres is at the`} <strong>{h.currentCrop.stageLabel}</strong>{lang === "en" ? " stage." : ""}
            </p>
          ) : (
            <p className="mt-1.5 max-w-md text-foreground/85">{lang === "en" ? "Here is what is happening in your network today." : "आज आपके नेटवर्क में क्या हो रहा है।"}</p>
          )}
        </div>
      </div>

      <QuickVoice />

      <StoriesRow stories={h.stories} />

      <section aria-labelledby="today">
        <SectionHeader title={t("section.today")} />
        <h2 id="today" className="sr-only">
          {t("section.today")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {h.nextActivity && <Tile href={`/crops/${h.nextActivity.cropId}`} icon={Calendar} label="Next activity" value={`${h.nextActivity.label} · ${h.nextActivity.cropName}`} sub={formatDate(h.nextActivity.date, { day: "numeric", month: "short" })} />}
          {h.market && <Tile href={`/market?crop=${h.market.crop}`} icon={Store} label={`${h.market.crop} on KaamSetu`} value={`${formatINR(h.market.avgPrice)} / qtl`} sub={`Avg. of ${h.market.listings} listings — not an official mandi rate`} tone="bg-accent/14 text-accent" />}
          {h.event && <Tile href={`/events/${h.event.id}`} icon={Calendar} label="Upcoming event" value={h.event.name} sub={`${formatDate(h.event.startsAt, { day: "numeric", month: "short" })} · ${h.event.location}`} tone="bg-info/14 text-info" />}
          <Tile href="/schemes" icon={Landmark} label="Government" value={h.government.latest ? h.government.latest.name : `${h.government.count} schemes`} sub={h.government.latest ? `${h.government.latest.org.name}${h.government.latest.isDemo ? " · DEMO" : ""}` : undefined} tone="bg-warning/16 text-warning" />
          {h.learning && <Tile href={`/learning/${h.learning.courseId}`} icon={GraduationCap} label={h.learning.progressPct ? "Continue learning" : "Suggested course"} value={h.learning.title} sub={h.learning.progressPct ? `${h.learning.progressPct}% complete` : undefined} tone="bg-success/14 text-success" />}
          {h.community.name && <Tile href={`/communities/${h.community.id}`} icon={Users} label="Community" value={h.community.name} sub={`${h.community.newPosts} new post${h.community.newPosts === 1 ? "" : "s"} this week`} tone="bg-danger/12 text-danger" />}
        </div>
      </section>

      {h.health && (
        <Card className="flex items-center gap-4 p-4">
          <ScoreRing score={h.health.score} label="Farm Health Score" size={92} />
          <div className="min-w-0">
            <p className="font-bold">Farm Health Score</p>
            <p className="text-sm text-muted-foreground">How complete your farm records are — not a measure of crop condition.</p>
            <Link href="/farms" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Improve your score <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {h.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {h.stats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-2xl border bg-card p-3.5 text-center shadow-card hover:bg-muted/50">
              <p className="text-2xl font-extrabold tabular-nums text-primary">{s.value}</p>
              <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FarmHomeView() {
  const home = useGet<HomeDTO>("/home");
  const [topic, setTopic] = useState<string>("ForYou");
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-8">
        <QueryBoundary query={home} skeleton={<ListSkeleton count={2} />}>
          {(h) => <Dashboard h={h} />}
        </QueryBoundary>
        <OpportunityStrip />
        <section aria-labelledby="feed-h">
          <SectionHeader title="Your feed" />
          <h2 id="feed-h" className="sr-only">
            Your feed
          </h2>
          <ChipRow items={FEED_TOPICS.filter((t) => t !== "ForYou")} all="For you" value={topic === "ForYou" ? "" : topic} onChange={(v) => setTopic(v || "ForYou")} label="Feed topics" />
          <div className="mt-4">
            <FeedList topic={topic} />
          </div>
        </section>
      </div>
      <aside className="hidden space-y-4 lg:block">
        <Card className="p-4">
          <p className="mb-1 flex items-center gap-2 font-bold">
            <Mic className="h-4 w-4 text-primary" aria-hidden /> Voice shortcuts
          </p>
          <p className="text-sm text-muted-foreground">Say what you need in Hindi, English or Hinglish — we take you straight there.</p>
        </Card>
        <Card className="p-4">
          <p className="mb-2 font-bold">Quick links</p>
          <ul className="space-y-1.5 text-sm font-semibold">
            {[
              ["/create", "Create a post or listing"],
              ["/experts?tab=questions&ask=1", "Ask an expert"],
              ["/schemes", "Browse government schemes"],
              ["/learning", "Open the Learning Hub"],
              ["/health", "Health & safety guide"],
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

/** Professionals get an adaptive dashboard; farmers and other roles keep the existing Home. */
export function HomeView() {
  const { data: me } = useMe();
  if (!me) return <ListSkeleton count={3} />;
  return me.role === "PROFESSIONAL" ? <ProfessionalHome /> : <FarmHomeView />;
}
