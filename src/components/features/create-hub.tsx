"use client";
import { Bookmark, Briefcase, CalendarPlus, Film, GraduationCap, Handshake, HelpCircle, Images, Landmark, Package, Pencil, Radio, Sprout, Tractor, UserCog, Users, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/section";
import { useGet } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { roleCan, type Capability } from "@/lib/capabilities";
import { CommunityForm, CourseForm, EventForm, LiveForm, ListingForm, MachineryForm, PostForm, ReelForm, RequirementForm, SchemeForm } from "./create-forms";
import { CropForm, FarmForm } from "./farm-forms";
import { OpportunityForm, PortfolioForm, ServiceForm } from "./pro-forms";
import { useCatalog } from "./pro-shared";
import { ListSkeleton } from "@/components/ui/skeleton";

interface Option {
  type: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  cap?: Capability;
  href?: string;
}

const OPTIONS: Option[] = [
  { type: "post", title: "Post an update", desc: "Share progress, a tip or a question with your network", icon: Pencil, cap: "post:create" },
  { type: "reel", title: "Create a reel", desc: "A short video or tip card", icon: Film, cap: "reel:create" },
  { type: "service", title: "Add a service", desc: "What you offer, what it costs, where you work", icon: UserCog, cap: "service:manage" },
  { type: "portfolio", title: "Add to portfolio", desc: "Show a piece of work you did, with photos", icon: Images, cap: "portfolio:manage" },
  { type: "opportunity", title: "Post an opportunity", desc: "Work, a job, an apprenticeship or a project", icon: Briefcase, cap: "work:post" },
  { type: "produce", title: "List produce for sale", desc: "Tell buyers what you have ready", icon: Package, cap: "listing:create" },
  { type: "requirement", title: "Post a buying requirement", desc: "Say what you need and where", icon: Handshake, cap: "requirement:create" },
  { type: "farm", title: "Add a farm", desc: "Land, soil and irrigation details", icon: Tractor, cap: "farm:manage" },
  { type: "crop", title: "Add a crop", desc: "Start tracking a crop and its seasons", icon: Sprout, cap: "farm:manage" },
  { type: "question", title: "Ask an expert", desc: "Get advice on a crop problem", icon: HelpCircle, cap: "question:ask", href: "/experts?tab=questions&ask=1" },
  { type: "machinery", title: "List machinery for rent", desc: "Tractor, harvester, sprayer…", icon: Wrench, cap: "machinery:list" },
  { type: "community", title: "Start a community", desc: "A group for a crop, place or method", icon: Users, cap: "community:create" },
  { type: "event", title: "Create an event", desc: "Training, kisan mela, webinar", icon: CalendarPlus, cap: "event:create" },
  { type: "live", title: "Schedule a live session", desc: "Q&A or demonstration", icon: Radio, cap: "live:host" },
  { type: "course", title: "Create a course", desc: "Teach what you know", icon: GraduationCap, cap: "course:create" },
  { type: "scheme", title: "Publish a scheme / notice", desc: "Official information with source link", icon: Landmark, cap: "scheme:publish" },
];

export function CreateHub() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: me } = useMe();
  const type = sp.get("type");
  const kinds = useGet<string[]>("/posts/allowed-kinds");
  const { professions } = useCatalog();
  // `?profession=` can be a catalog id or a name from the voice / assistant router ("Electrician").
  const wanted = sp.get("profession")?.toLowerCase();
  const presetProfession = wanted ? professions.find((p) => p.id.toLowerCase() === wanted || p.name.toLowerCase() === wanted)?.id : undefined;
  const options = useMemo(() => OPTIONS.filter((o) => !o.cap || roleCan(me?.role, o.cap)), [me?.role]);
  const current = options.find((o) => o.type === type);

  if (!me) return <ListSkeleton count={2} />;

  if (current && !current.href) {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={() => router.push("/create")} className="mb-2 text-sm font-semibold text-primary hover:underline">
          ← All options
        </button>
        <PageHeader title={current.title} subtitle={current.desc} />
        <Card className="p-5">
          {current.type === "post" && (kinds.data ? <PostForm kinds={kinds.data} /> : <ListSkeleton count={1} />)}
          {current.type === "reel" && <ReelForm />}
          {current.type === "service" && <ServiceForm onDone={() => router.push("/my-work")} />}
          {current.type === "portfolio" && <PortfolioForm onDone={() => router.push("/profile")} />}
          {current.type === "opportunity" && <OpportunityForm key={presetProfession ?? "none"} defaultProfessionIds={presetProfession ? [presetProfession] : undefined} onDone={(w) => router.push(`/opportunities/${w.id}`)} />}
          {current.type === "produce" && <ListingForm />}
          {current.type === "requirement" && <RequirementForm />}
          {current.type === "farm" && <FarmForm onDone={(f) => router.push(`/farms/${f.id}`)} />}
          {current.type === "crop" && <CropForm defaultFarmId={sp.get("farm") ?? undefined} onDone={(c) => router.push(`/crops/${c.id}`)} />}
          {current.type === "machinery" && <MachineryForm />}
          {current.type === "community" && <CommunityForm />}
          {current.type === "event" && <EventForm />}
          {current.type === "live" && <LiveForm />}
          {current.type === "course" && <CourseForm />}
          {current.type === "scheme" && <SchemeForm />}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Create" subtitle="Post, reel, service, portfolio or opportunity — what would you like to do?" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <li key={o.type}>
            <Link href={o.href ?? `/create?type=${o.type}`} className="flex h-full items-start gap-3.5 rounded-2xl border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <o.icon className="h-6 w-6" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{o.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{o.desc}</span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/saved" className="flex h-full items-start gap-3.5 rounded-2xl border border-dashed bg-card p-4 transition-colors hover:bg-muted/50">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Bookmark className="h-6 w-6" aria-hidden />
            </span>
            <span>
              <span className="block font-bold">Saved items</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">Posts, produce, schemes and events you saved</span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
