"use client";
import { BadgeCheck, Bot, Briefcase, ClipboardList, Handshake, Images, Landmark, Lock, ShieldCheck, Tractor, UserRound } from "lucide-react";
import Link from "next/link";
import { Scene } from "@/components/art/scene";
import { LandingAuthButtons } from "./landing-auth";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useGet } from "@/hooks/use-api";
import { SUBHEADING, TAGLINE, TAGLINE_HI } from "@/lib/constants";
import type { SceneKind } from "@/types/domain";

const PERSONAS: { name: string; emoji: string; scene: SceneKind; href: string }[] = [
  { name: "Farmer", emoji: "🌾", scene: "wheat", href: "/register?role=FARMER" },
  { name: "Electrician", emoji: "⚡", scene: "workshop", href: "/register?profession=pr_electrician" },
  { name: "Carpenter", emoji: "🪚", scene: "carpentry", href: "/register?profession=pr_carpenter" },
  { name: "Mechanic", emoji: "🔧", scene: "tractor", href: "/register?profession=pr_mechanic" },
  { name: "Driver", emoji: "🚚", scene: "road", href: "/register?profession=pr_driver" },
  { name: "Tailor", emoji: "🧵", scene: "tailoring", href: "/register?profession=pr_tailor" },
  { name: "Artisan", emoji: "🏺", scene: "pottery", href: "/register?profession=pr_handicraft" },
];

const STEPS: { icon: typeof Tractor; title: string; body: string }[] = [
  { icon: UserRound, title: "Create your profile", body: "Eight short steps: your work, experience, skills, services, place and availability. Speak or type in Hindi, English or Hinglish." },
  { icon: Images, title: "Show your work", body: "Add photos of jobs you did, your work history and the services you offer. People trust what they can see." },
  { icon: Briefcase, title: "Find and be found", body: "Get service requests from people nearby, apply for work, or post an opportunity when you need to hire." },
];

const FEATURES: { icon: typeof Tractor; title: string; body: string }[] = [
  { icon: UserRound, title: "A professional identity", body: "One profile for your trade — skills, experience, certificates, portfolio and availability. Your work, not just a phone number." },
  { icon: ClipboardList, title: "Services & requests", body: "List what you offer. Customers request a date and place; you accept or decline and talk it through in Messages. No payments on KaamSetu." },
  { icon: Briefcase, title: "Opportunity Center", body: "Daily work, contracts, seasonal jobs, apprenticeships, freelance projects, training and events — matched to your profession and place." },
  { icon: Images, title: "Portfolio & work history", body: "Photos and details of real jobs, plus the places and kinds of work you have done, including self-employed and family work." },
  { icon: ShieldCheck, title: "Reputation you can check", body: "Only facts: jobs completed, recommendations from people you worked with, verified skills. No star ratings, no invented scores." },
  { icon: Landmark, title: "Programmes & learning", body: "Skill development, employment, apprenticeship and worker-welfare programmes with the official source linked, and short courses for your trade." },
  { icon: Bot, title: "AI assistant, Hindi-first", body: "Ask for an electrician in Churu, work near you, or a scheme — by voice or text. It never invents wages, ratings or payments." },
  { icon: Tractor, title: "Full farm tools for farmers", body: "Farms, crops, harvests, produce for sale, buyers and experts stay exactly as before — a farmer is a professional with extra tools." },
];

const ROLES: { title: string; body: string; scene: SceneKind; role: string }[] = [
  { title: "Professionals", body: "Farmers, electricians, carpenters, drivers, tailors, artisans and more.", scene: "workshop", role: "PROFESSIONAL" },
  { title: "Buyers & hirers", body: "Post requirements and work; find verified professionals and farmers.", scene: "market", role: "BUYER" },
  { title: "Experts", body: "Answer questions, teach courses and grow a following.", scene: "classroom", role: "EXPERT" },
  { title: "Government & orgs", body: "Share schemes, programmes, events and announcements.", scene: "sunrise", role: "GOVERNMENT" },
  { title: "FPOs & co-operatives", body: "Aggregate member produce and reach larger buyers.", scene: "dairy", role: "FPO" },
];

export function Landing() {
  const health = useGet<{ mode: string }>("/healthz", { staleTime: 60_000 });
  const isDemo = health.data?.mode === "demo";

  return (
    <div className="overflow-x-hidden">
      <header className="absolute inset-x-0 top-0 z-20 pt-safe">
        <div className="page-pad mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="bg-card/70 backdrop-blur" />
            <LandingAuthButtons compact />
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <Scene kind="workshop" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/10 via-background/25 to-background" />
        <div className="page-pad mx-auto max-w-6xl pb-10 pt-20 sm:pb-16 sm:pt-24 md:pb-24 md:pt-36">
          <div className="max-w-3xl rounded-2xl sm:rounded-3xl border border-border/50 bg-background/85 p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-card">
            <p className="mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-2.5 py-1 text-xs sm:text-sm font-semibold text-foreground/90 backdrop-blur">
              <BadgeCheck className="h-4 w-4 shrink-0 text-info" aria-hidden />
              <span>Built for India&rsquo;s skilled workforce · हिन्दी · English · Hinglish</span>
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15]">
              {TAGLINE}
            </h1>
            <p className="mt-2 text-base sm:text-lg md:text-xl font-bold text-primary">{TAGLINE_HI}</p>
            <p className="mt-3 text-sm sm:text-base md:text-lg font-semibold text-foreground/90 leading-snug">{SUBHEADING}</p>
            <p className="mt-1.5 text-xs sm:text-sm md:text-base text-foreground/75 leading-relaxed">
              Farmers, electricians, carpenters, mechanics, drivers, tailors, artisans and more. Build a trusted profile, show your work, get service requests and find opportunities — in one calm, simple app.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <ButtonLink href="/register?role=PROFESSIONAL" size="md" className="w-full sm:w-auto text-center justify-center font-bold min-h-11">
                Create Professional Profile
              </ButtonLink>
              <ButtonLink href="/professionals" size="md" variant="outline" className="w-full sm:w-auto text-center justify-center bg-card/90 backdrop-blur min-h-11">
                Find Professionals
              </ButtonLink>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-xs sm:text-sm">
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Already a member? Sign in
              </Link>
              <span className="text-muted-foreground text-xs">
                {isDemo
                  ? "Demo mode: sample people and data are marked DEMO."
                  : "Free professional profile · Direct connections"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-pad mx-auto max-w-6xl pt-10 sm:pt-14" aria-labelledby="personas">
        <h2 id="personas" className="mb-1.5 text-xl sm:text-2xl font-bold">Every kind of work. One identity.</h2>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-muted-foreground">Pick your profession to start. Not listed? Add your own when you sign up.</p>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 sm:gap-3">
          {PERSONAS.map((p) => (
            <li key={p.name}>
              <Link href={p.href} className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-transform hover:-translate-y-0.5">
                <div className="h-20 sm:h-24 overflow-hidden">
                  <Scene kind={p.scene} className="transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="px-2.5 py-2 text-center text-xs sm:text-sm font-bold">
                  <span aria-hidden>{p.emoji}</span> {p.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-pad mx-auto max-w-6xl py-10 sm:py-14" aria-labelledby="how">
        <h2 id="how" className="mb-4 sm:mb-6 text-xl sm:text-2xl font-bold">How it works</h2>
        <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <Card className="h-full p-4 sm:p-5">
                <span className="mb-3 flex items-center gap-3">
                  <span className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <st.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-muted-foreground">Step {i + 1}</span>
                </span>
                <h3 className="text-sm sm:text-base">{st.title}</h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{st.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-pad mx-auto max-w-6xl pb-10 sm:pb-14" aria-labelledby="who">
        <h2 id="who" className="mb-1.5 text-xl sm:text-2xl font-bold">Made for people who work, hire and support work</h2>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-muted-foreground">One network where professionals, the people who hire them, experts and local institutions can find each other.</p>
        <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <li key={r.title}>
              <Link href={`/register?role=${r.role}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-transform hover:-translate-y-0.5">
                <div className="h-24 sm:h-28 overflow-hidden">
                  <Scene kind={r.scene} className="transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3.5 sm:p-4">
                  <h3 className="text-sm sm:text-base">{r.title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted/50 py-10 sm:py-14" aria-labelledby="features">
        <div className="page-pad mx-auto max-w-6xl">
          <h2 id="features" className="mb-4 sm:mb-6 text-xl sm:text-2xl font-bold">Everything your work needs</h2>
          <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full p-4 sm:p-5">
                  <span className="mb-3 grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl bg-primary/12 text-primary">
                    <f.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                  </span>
                  <h3 className="text-sm sm:text-base">{f.title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-pad mx-auto grid max-w-6xl gap-6 sm:gap-8 py-10 sm:py-14 md:grid-cols-2 md:items-center" aria-labelledby="trust">
        <div>
          <h2 id="trust" className="mb-3 text-xl sm:text-2xl font-bold">Trust and privacy come first</h2>
          <ul className="space-y-3 text-xs sm:text-sm text-foreground/85 leading-relaxed">
            {[
              [Lock, "Your exact home address is never shown — only your district or village, as you choose. Income and farm records stay private by default."],
              [BadgeCheck, "Verified badges are granted only by KaamSetu admins after review. Nobody can give themselves a badge."],
              [Handshake, "No payments on the platform and no made-up ratings. Messages are screened for OTP, Aadhaar and card details to protect you from scams."],
              [Landmark, "Government and programme content always links to the official source. We never invent scheme details or eligibility."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Lock;
              return (
                <li key={i} className="flex gap-2.5 sm:gap-3">
                  <I className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-primary" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="overflow-hidden rounded-2xl sm:rounded-3xl border shadow-card">
          <div className="aspect-[16/10] sm:aspect-[5/3]">
            <Scene kind="construction" decorative={false} title="A building site with workers" />
          </div>
        </div>
      </section>

      <section className="page-pad mx-auto max-w-6xl pb-12 sm:pb-16">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary p-6 sm:p-8 md:p-12 text-primary-foreground">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 opacity-40 md:block">
            <Scene kind="sunrise" />
          </div>
          <h2 className="max-w-lg text-xl sm:text-2xl md:text-3xl text-primary-foreground font-bold">Your work deserves an identity.</h2>
          <p className="mt-2 max-w-lg text-xs sm:text-sm md:text-base text-primary-foreground/85 leading-relaxed">Set up your professional profile in a few minutes. Add your work when you are ready.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <ButtonLink href="/register?role=PROFESSIONAL" size="md" variant="secondary" className="w-full sm:w-auto text-center justify-center font-bold min-h-11">
              Join KaamSetu
            </ButtonLink>
            <ButtonLink href="/login" size="md" variant="ghost" className="w-full sm:w-auto text-center justify-center text-primary-foreground hover:bg-white/15 min-h-11">
              I already have an account
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 sm:py-8 bg-card/40">
        <div className="page-pad mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          <Logo />
          <p className="max-w-md">
            {isDemo
              ? "KaamSetu demo mode. Sample content is marked DEMO."
              : "KaamSetu — Connecting India's skilled workforce with local opportunities."}
          </p>
        </div>
      </footer>
    </div>
  );
}
