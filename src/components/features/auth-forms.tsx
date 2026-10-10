"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Handshake, KeyRound, Landmark, Loader2, Smartphone, Sprout, Users, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/providers/toast";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useGet } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import { loginEmailSchema, loginPhoneSchema, otpVerifySchema, registerSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Me, UserSummary } from "@/types/dto";
import type { Role } from "@/types/domain";
import { ProfessionPicker } from "./profession-picker";

function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function useAfterAuth(fallback = "/home") {
  const router = useRouter();
  const qc = useQueryClient();
  const sp = useSearchParams();
  return (me: Me, dest?: string) => {
    qc.setQueryData(["api", "/auth/me"], me);
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] !== "/auth/me" });
    router.replace(dest ?? safeNext(sp.get("next"), fallback));
  };
}

interface Challenge {
  challengeId: string;
  devCode?: string;
}

/** Step 2 of OTP flows. In dev mode the server returns the code so the flow is testable without an SMS provider. */
function OtpStep({ challenge, identifier, onVerified, onBack }: { challenge: Challenge; identifier: string; onVerified: (me: Me) => void; onBack: () => void }) {
  type Form = z.infer<typeof otpVerifySchema>;
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(otpVerifySchema), defaultValues: { challengeId: challenge.challengeId, code: "" } });
  const [busy, setBusy] = useState(false);
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      onVerified(await api<Me>("POST", "/auth/otp/verify", v));
    } catch (e) {
      setError("code", { message: e instanceof ApiClientError ? e.message : "Could not verify the code" });
    } finally {
      setBusy(false);
    }
  });
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <strong className="text-foreground">{identifier}</strong>.
      </p>
      {challenge.devCode && (
        <Notice tone="warning" title="Testing verification code">
          Testing mode active: enter code <strong className="font-mono text-base tracking-widest">{challenge.devCode}</strong> to continue. Phone will remain unverified until SMS gateway is active.
        </Notice>
      )}
      <input type="hidden" {...register("challengeId")} />
      <Field label="Enter code" error={formState.errors.code?.message} required>
        {(a) => <Input {...a} {...register("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" className="text-center text-xl tracking-[0.5em]" data-autofocus />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Verify & continue
      </Button>
      <button type="button" onClick={onBack} className="tap w-full text-sm font-semibold text-primary hover:underline">
        Use a different number / go back
      </button>
    </form>
  );
}

function DemoAccounts({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  const accounts = useGet<UserSummary[]>("/auth/demo-accounts", { staleTime: 5 * 60_000 });
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!accounts.data?.length) return null;
  const go = async (id: string) => {
    setBusy(id);
    try {
      onSignedIn(await api<Me>("POST", "/auth/demo", { userId: id }));
    } catch (e) {
      toast({ kind: "error", title: "Demo sign-in failed", description: e instanceof Error ? e.message : undefined });
      setBusy(null);
    }
  };
  return (
    <Card className="mt-5 border-dashed p-4">
      <p className="text-sm font-bold">Explore with a demo account</p>
      <p className="mb-3 text-xs text-muted-foreground">Sample people and data — clearly marked DEMO. No real accounts are involved.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {accounts.data.map((u) => (
          <li key={u.id}>
            <button onClick={() => go(u.id)} disabled={busy !== null} className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60">
              {busy === u.id ? <Loader2 className="h-9 w-9 animate-spin p-2 text-primary" /> : <Avatar name={u.name} hue={u.hue} size="sm" />}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{u.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PhoneLogin({ onVerified }: { onVerified: (me: Me) => void }) {
  type Form = z.infer<typeof loginPhoneSchema>;
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(loginPhoneSchema) });
  const [challenge, setChallenge] = useState<(Challenge & { phone: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  if (challenge) return <OtpStep challenge={challenge} identifier={challenge.phone} onVerified={onVerified} onBack={() => setChallenge(null)} />;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setBusy(true);
        try {
          const c = await api<Challenge>("POST", "/auth/otp/request", v);
          setChallenge({ ...c, phone: v.phone });
        } catch (e) {
          setError("phone", { message: e instanceof ApiClientError ? e.message : "Could not send the code" });
        } finally {
          setBusy(false);
        }
      })}
    >
      <Field label="Mobile number" hint="We'll send a 6-digit code. No password needed." error={formState.errors.phone?.message} required>
        {(a) => <Input {...a} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98xxxxxxxx" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        <Smartphone className="h-4 w-4" /> Send code
      </Button>
    </form>
  );
}

function EmailLogin({ onSignedIn }: { onSignedIn: (me: Me) => void }) {
  type Form = z.infer<typeof loginEmailSchema>;
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(loginEmailSchema) });
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setBusy(true);
        try {
          onSignedIn(await api<Me>("POST", "/auth/login", v));
        } catch (e) {
          setError("password", { message: e instanceof ApiClientError ? e.message : "Could not sign in" });
        } finally {
          setBusy(false);
        }
      })}
    >
      <Field label="Email or mobile number" error={formState.errors.email?.message} required>
        {(a) => <Input {...a} {...register("email")} autoComplete="username" placeholder="you@example.com or 98xxxxxxxx" />}
      </Field>
      <Field label="Password" error={formState.errors.password?.message} required>
        {(a) => <Input {...a} {...register("password")} type="password" autoComplete="current-password" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        <KeyRound className="h-4 w-4" /> Sign in
      </Button>
    </form>
  );
}

function LoginInner() {
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const after = useAfterAuth();
  return (
    <>
      <Card className="p-5 md:p-6">
        <h1 className="text-2xl">Welcome back</h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Sign in to your profile, work and opportunities.</p>
        <Tabs
          label="Sign-in method"
          value={tab}
          onChange={setTab}
          items={[
            { id: "phone", label: "Phone OTP" },
            { id: "email", label: "Password" },
          ]}
          className="mb-5"
        />
        {tab === "phone" ? <PhoneLogin onVerified={(me) => after(me)} /> : <EmailLogin onSignedIn={(me) => after(me)} />}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to KaamSetu?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
      <DemoAccounts onSignedIn={(me) => after(me)} />
    </>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

// ───────────── register ─────────────
const ROLES: { id: Exclude<Role, "ADMIN" | "FARMER">; icon: typeof Wrench; blurb: string }[] = [
  { id: "PROFESSIONAL", icon: Wrench, blurb: "Farmer, electrician, carpenter, driver, tailor, artisan and more — show your work and find opportunities" },
  { id: "BUYER", icon: Handshake, blurb: "Post requirements and discover farmers" },
  { id: "EXPERT", icon: Sprout, blurb: "Answer questions, share advice, teach" },
  { id: "GOVERNMENT", icon: Landmark, blurb: "Publish schemes, events and announcements" },
  { id: "FPO", icon: Users, blurb: "Aggregate produce and support members" },
];

type RegisterForm = z.input<typeof registerSchema>;

function RegisterInner() {
  const sp = useSearchParams();
  const after = useAfterAuth("/profile/edit?welcome=1");
  // Old links (?role=FARMER) keep working: a farmer is a Professional whose profession is Farmer.
  const rawRole = (sp.get("role") ?? "PROFESSIONAL").toUpperCase();
  const initialRole = (rawRole === "FARMER" ? "PROFESSIONAL" : ROLES.some((r) => r.id === rawRole) ? rawRole : "PROFESSIONAL") as RegisterForm["role"];
  const initialProfession = rawRole === "FARMER" ? "pr_farmer" : (sp.get("profession") ?? undefined);
  const { register, handleSubmit, formState, setError, setValue, watch } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole, name: "", phone: "", email: "", password: "", district: "", professionId: initialProfession, customProfession: "" },
  });
  const [challenge, setChallenge] = useState<(Challenge & { ident: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const role = watch("role");
  const professionId = watch("professionId");
  const customProfession = watch("customProfession");

  if (challenge) return <Card className="p-5 md:p-6"><h1 className="mb-4 text-2xl">Verify your number</h1><OtpStep challenge={challenge} identifier={challenge.ident} onVerified={(me) => after(me, me.role === "PROFESSIONAL" ? "/profile/create" : undefined)} onBack={() => setChallenge(null)} /></Card>;

  return (
    <Card className="p-5 md:p-6">
      <h1 className="text-2xl">Create your KaamSetu account</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Free to join. Your work, your identity, your opportunities. Verified badges are granted only after admin review — never self-assigned.</p>
      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit(async (v) => {
          setBusy(true);
          try {
            const c = await api<Challenge>("POST", "/auth/register", v);
            setChallenge({ ...c, ident: v.phone || v.email || "" });
          } catch (e) {
            if (e instanceof ApiClientError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof RegisterForm, { message: m });
            else setError("name", { message: e instanceof ApiClientError ? e.message : "Could not create the account" });
          } finally {
            setBusy(false);
          }
        })}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">I am a…</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
            {ROLES.map((r) => (
              <button type="button" key={r.id} role="radio" aria-checked={role === r.id} onClick={() => setValue("role", r.id, { shouldValidate: true })} className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors", role === r.id ? "border-primary bg-primary/8 ring-1 ring-primary" : "hover:bg-muted")}>
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", role === r.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <r.icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{ROLE_LABEL[r.id]}</span>
                  <span className="block text-xs text-muted-foreground">{r.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {role === "PROFESSIONAL" && (
          <div>
            <p className="mb-2 text-sm font-semibold">
              What work do you do? <span className="text-danger">*</span>
            </p>
            <ProfessionPicker
              value={{ professionId, customProfession: customProfession || undefined }}
              onChange={(v) => {
                setValue("professionId", v.professionId ?? "", { shouldValidate: formState.isSubmitted });
                setValue("customProfession", v.customProfession ?? "", { shouldValidate: formState.isSubmitted });
              }}
            />
            {formState.errors.professionId?.message && (
              <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">
                {formState.errors.professionId.message}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={formState.errors.name?.message} required className="sm:col-span-2">
            {(a) => <Input {...a} {...register("name")} autoComplete="name" placeholder="e.g. Ramesh Choudhary" />}
          </Field>
          <Field label="Mobile number" error={formState.errors.phone?.message}>
            {(a) => <Input {...a} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="98xxxxxxxx" />}
          </Field>
          <Field label="Email (optional)" error={formState.errors.email?.message}>
            {(a) => <Input {...a} {...register("email")} type="email" autoComplete="email" />}
          </Field>
          <Field label="District" error={formState.errors.district?.message} hint="Helps us show nearby buyers and events">
            {(a) => <Input {...a} {...register("district")} placeholder="e.g. Churu" />}
          </Field>
          <Field label="Password" error={formState.errors.password?.message} hint="Used to sign in with your phone or email">
            {(a) => <Input {...a} {...register("password")} type="password" autoComplete="new-password" />}
          </Field>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          <UserRound className="h-4 w-4" /> Continue
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          Your income, expenses and phone number stay private by default. You decide what to share.
        </p>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export function RegisterFormView() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}

