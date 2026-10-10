import { BadgeCheck, Bot, Briefcase, ClipboardList, Handshake, Images, Landmark, Lock, ShieldCheck, Tractor, UserRound } from "lucide-react";
import Link from "next/link";
import { Scene } from "@/components/art/scene";
import { LandingAuthButtons } from "./landing-auth";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  return (
    <div>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="page-pad mx-auto flex h-16 max-w-6xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle className="bg-card/70 backdrop-blur" />
            <LandingAuthButtons compact />
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <Scene kind="workshop" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/10 via-background/20 to-background" />
        <div className="page-pad mx-auto max-w-6xl pb-16 pt-28 md:pb-24 md:pt-40">
          <div className="max-w-3xl rounded-3xl bg-background/75 p-5 backdrop-blur-md md:p-9">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-sm font-semibold backdrop-blur">
            <BadgeCheck className="h-4 w-4 text-info" aria-hidden /> Built for India&rsquo;s skilled and local workforce · हिन्दी · English · Hinglish
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.1] md:text-6xl">
            {TAGLINE}
          </h1>
          <p className="mt-3 text-lg font-semibold text-primary md:text-xl">{TAGLINE_HI}</p>
          <p className="mt-5 max-w-2xl text-lg font-semibold text-foreground/90 md:text-xl">{SUBHEADING}</p>
          <p className="mt-2 max-w-2xl text-foreground/80 md:text-lg">
            Farmers, electricians, carpenters, mechanics, drivers, tailors, artisans and more. Build a trusted profile, show your work, get service requests and find opportunities — in one calm, simple app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register?role=PROFESSIONAL" size="lg">
              Create Professional Profile
            </ButtonLink>
            <ButtonLink href="/professionals" size="lg" variant="outline" className="bg-card/80 backdrop-blur">
              Find Professionals
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Already a member? Sign in
            </Link>
          </p>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">The demo uses clearly marked sample people and data. No payments, no real transactions. Finding professionals needs a free account.</p>
          </div>
        </div>
      </section>

      <section className="page-pad mx-auto max-w-6xl pt-14" aria-labelledby="personas">
        <h2 id="personas" className="mb-2">Every kind of work. One identity.</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground">Pick your profession to start. Not listed? Add your own when you sign up.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {PERSONAS.map((p) => (
            <li key={p.name}>
              <Link href={p.href} className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-transform hover:-translate-y-0.5">
                <div className="h-24 overflow-hidden">
                  <Scene kind={p.scene} className="transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="px-3 py-2.5 text-center font-bold">
                  <span aria-hidden>{p.emoji}</span> {p.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-pad mx-auto max-w-6xl py-14" aria-labelledby="how">
        <h2 id="how" className="mb-6">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <Card className="h-full p-5">
                <span className="mb-3 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <st.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">Step {i + 1}</span>
                </span>
                <h3 className="text-base">{st.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{st.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-pad mx-auto max-w-6xl pb-14" aria-labelledby="who">
        <h2 id="who" className="mb-2">Made for people who work, hire and support work</h2>
        <p className="mb-6 max-w-2xl text-muted-foreground">One network where professionals, the people who hire them, experts and local institutions can find each other.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <li key={r.title}>
              <Link href={`/register?role=${r.role}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-card transition-transform hover:-translate-y-0.5">
                <div className="h-28 overflow-hidden">
                  <Scene kind={r.scene} className="transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <h3 className="text-base">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted/50 py-14" aria-labelledby="features">
        <div className="page-pad mx-auto max-w-6xl">
          <h2 id="features" className="mb-6">Everything your work needs</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full p-5">
                  <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary">
                    <f.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="text-base">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page-pad mx-auto grid max-w-6xl gap-8 py-14 md:grid-cols-2 md:items-center" aria-labelledby="trust">
        <div>
          <h2 id="trust" className="mb-3">Trust and privacy come first</h2>
          <ul className="space-y-3 text-foreground/85">
            {[
              [Lock, "Your exact home address is never shown — only your district or village, as you choose. Income and farm records stay private by default."],
              [BadgeCheck, "Verified badges are granted only by KaamSetu admins after review. Nobody can give themselves a badge."],
              [Handshake, "No payments on the platform and no made-up ratings. Messages are screened for OTP, Aadhaar and card details to protect you from scams."],
              [Landmark, "Government and programme content always links to the official source. We never invent scheme details or eligibility."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Lock;
              return (
                <li key={i} className="flex gap-3">
                  <I className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="overflow-hidden rounded-3xl border shadow-card">
          <div className="aspect-[5/3]">
            <Scene kind="construction" decorative={false} title="A building site with workers" />
          </div>
        </div>
      </section>

      <section className="page-pad mx-auto max-w-6xl pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground md:p-12">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 opacity-40 md:block">
            <Scene kind="sunrise" />
          </div>
          <h2 className="max-w-lg text-primary-foreground">Your work deserves an identity.</h2>
          <p className="mt-2 max-w-lg text-primary-foreground/85">Set up your professional profile in a few minutes. Add your work when you are ready.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/register?role=PROFESSIONAL" size="lg" variant="secondary">
              Join KaamSetu
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="ghost" className="text-primary-foreground hover:bg-white/15">
              I already have an account
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="page-pad mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <Logo />
          <p>KaamSetu does not provide financial, legal or medical advice. Sample content in demo mode is marked DEMO.</p>
        </div>
      </footer>
    </div>
  );
}
