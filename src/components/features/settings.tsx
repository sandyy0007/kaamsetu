"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LogOut, ShieldCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useI18n } from "@/components/providers/i18n";
import { useTheme, type Mode, type Preset } from "@/components/providers/theme";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { Segmented } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/features/verification-badge";
import { useGet, useInvalidate, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { NOTIFICATION_LABEL, VISIBILITY_LABEL, VISIBILITY_ORDER } from "@/lib/constants";
import { LANGUAGE_LABEL } from "@/lib/i18n";
import { cn, formatDate } from "@/lib/utils";
import type { Language, NotificationType, PrivacySettings, Visibility } from "@/types/domain";
import type { UserSummary, VerificationStatusDTO } from "@/types/dto";

const PRESETS: { id: Preset; name: string; note: string; bg: string; fg: string; primary: string; accent: string }[] = [
  { id: "farm-light", name: "Farm Light", note: "Default. Warm, high contrast.", bg: "42 38% 96%", fg: "150 20% 10%", primary: "142 56% 26%", accent: "28 52% 36%" },
  { id: "farm-dark", name: "Farm Dark", note: "True dark for night and low light.", bg: "150 24% 6%", fg: "40 30% 94%", primary: "142 52% 46%", accent: "32 58% 62%" },
  { id: "earth", name: "Earth", note: "Soil and olive tones. Follows Light/Dark.", bg: "36 30% 91%", fg: "30 20% 12%", primary: "96 38% 27%", accent: "24 50% 34%" },
  { id: "sunrise", name: "Sunrise", note: "Saffron and green. Follows Light/Dark.", bg: "38 80% 96%", fg: "20 30% 12%", primary: "20 88% 35%", accent: "142 52% 28%" },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <Card className="p-5">
        <h2 id={`${id}-h`} className="text-lg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-4">{children}</div>
      </Card>
    </section>
  );
}

function Appearance() {
  const { preset, setPreset, mode, setMode } = useTheme();
  return (
    <Section id="appearance" title="Appearance" description="Saved on this device. Every screen supports every theme.">
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((p) => {
          const on = preset === p.id;
          return (
            <button key={p.id} role="radio" aria-checked={on} onClick={() => setPreset(p.id)} className={cn("flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors", on ? "border-primary bg-primary/6" : "border-border hover:bg-muted/60")}>
              <span className="grid h-14 w-20 shrink-0 grid-cols-3 overflow-hidden rounded-xl border" style={{ background: `hsl(${p.bg})` }} aria-hidden>
                <span className="col-span-3 m-1.5 rounded-md" style={{ background: `hsl(${p.primary})` }} />
                <span className="m-1.5 mt-0 h-2 rounded" style={{ background: `hsl(${p.accent})` }} />
                <span className="col-span-2 m-1.5 mt-0 h-2 rounded" style={{ background: `hsl(${p.fg} / .5)` }} />
              </span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-bold">{p.name}{on && <Check className="h-4 w-4 text-primary" aria-label="Selected" />}</span><span className="block text-xs text-muted-foreground">{p.note}</span></span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Colour mode</p>
        <Segmented<Mode> label="Colour mode" value={mode} onChange={setMode} items={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "system", label: "System" }]} />
        <p className="mt-2 text-xs text-muted-foreground">Farm Light/Dark are shortcuts for the Farm palette in Light/Dark mode.</p>
      </div>
    </Section>
  );
}

const accountForm = z.object({ name: z.string().trim().min(2, "Enter your name").max(80), headline: z.string().trim().max(140).optional(), language: z.enum(["en", "hi", "hinglish"]) });

function Account() {
  const me = useMe().data!;
  const { setLang } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof accountForm>>({ resolver: zodResolver(accountForm), defaultValues: { name: me.name, headline: me.headline ?? "", language: me.language } });
  const submit = handleSubmit(async (v) => {
    try {
      await api("PATCH", "/me", v);
      setLang(v.language);
      await invalidate("/auth/me", "/farmers", "/profile");
      toast({ title: "Account updated" });
    } catch (e) {
      setError("name", { message: e instanceof ApiClientError ? e.message : "Couldn't save" });
    }
  });
  return (
    <Section id="account" title="Account" description="Your name and language. Your role can't be changed here.">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={formState.errors.name?.message} required>{(a) => <Input {...a} {...register("name")} autoComplete="name" />}</Field>
        <Field label="Language" hint="Used for the interface and voice input.">{(a) => <Select {...a} {...register("language")}>{(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}</Select>}</Field>
        <div className="sm:col-span-2"><Field label="Headline" error={formState.errors.headline?.message}>{(a) => <Input {...a} {...register("headline")} placeholder="e.g. Organic mustard farmer, Churu" />}</Field></div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button type="submit" loading={formState.isSubmitting}>Save changes</Button><span className="text-sm text-muted-foreground">{me.email ?? me.phone}</span></div>
      </form>
    </Section>
  );
}

const PRIVACY_FIELDS: { key: keyof Omit<PrivacySettings, "locationPrecision">; label: string; hint: string; sensitive?: boolean }[] = [
  { key: "profile", label: "Profile", hint: "Who can see your full profile." },
  { key: "produce", label: "Produce available", hint: "Quantities you have for sale." },
  { key: "farmPhotos", label: "Farm photos", hint: "Photos from your farms and crops." },
  { key: "phone", label: "Phone number", hint: "Never shown unless you allow it.", sensitive: true },
  { key: "income", label: "Income", hint: "Private by default. Only share if you choose to.", sensitive: true },
  { key: "financialRecords", label: "Costs and revenue records", hint: "Private by default.", sensitive: true },
];

function Privacy() {
  const me = useMe().data;
  const q = useGet<PrivacySettings | null>("/me/privacy", { staleTime: 0 });
  // Non-farm professionals have no farm finances, so only profile, phone and location precision apply to them.
  const fields = me?.role === "PROFESSIONAL" ? PRIVACY_FIELDS.filter((f) => f.key === "profile" || f.key === "phone") : PRIVACY_FIELDS;
  const toast = useToast();
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<PrivacySettings | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);
  const save = useSend<PrivacySettings, PrivacySettings>("PUT", "/me/privacy", {
    onSuccess: () => {
      toast({ title: "Privacy settings saved" });
      void invalidate("/me/privacy", "/farmers", "/professionals", "/profile");
    },
    onError: (e) => toast({ kind: "error", title: "Couldn't save", description: e.message }),
  });
  return (
    <Section id="privacy" title="Privacy" description="You decide who sees what. Your exact home address, and Aadhaar, bank, UPI and loan details, are never shown to anyone on KaamSetu.">
      {q.isLoading ? <ListSkeleton count={2} /> : !draft ? <p className="text-sm text-muted-foreground">Privacy controls apply to farmer and professional profiles.</p> : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.sensitive ? `Sensitive. ${f.hint}` : f.hint}>
                {(a) => <Select {...a} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as Visibility })}>{VISIBILITY_ORDER.map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}</Select>}
              </Field>
            ))}
            <Field label="Location precision" hint="District hides your village from others.">
              {(a) => <Select {...a} value={draft.locationPrecision} onChange={(e) => setDraft({ ...draft, locationPrecision: e.target.value as PrivacySettings["locationPrecision"] })}><option value="DISTRICT">District only</option><option value="VILLAGE">Village and district</option></Select>}
            </Field>
          </div>
          {(draft.income !== "PRIVATE" || draft.financialRecords !== "PRIVATE") && <Notice tone="warning">You are sharing income or financial records beyond yourself. Only people in the audience you chose will see a summary; exact records stay hidden.</Notice>}
          <Button onClick={() => save.mutate(draft)} loading={save.isPending}>Save privacy settings</Button>
        </div>
      )}
    </Section>
  );
}

function Notifications() {
  const me = useMe().data!;
  const toast = useToast();
  const invalidate = useInvalidate();
  const [prefs, setPrefs] = useState(me.notificationPrefs);
  const save = useSend<Partial<Record<NotificationType, boolean>>, unknown>("PUT", "/me/notification-prefs", { invalidate: ["/auth/me"], onError: (e) => toast({ kind: "error", title: "Couldn't save", description: e.message }) });
  const toggle = (k: NotificationType, v: boolean) => {
    const prev = prefs;
    setPrefs({ ...prefs, [k]: v });
    save.mutate({ [k]: v }, { onError: () => setPrefs(prev), onSuccess: () => void invalidate("/auth/me") });
  };
  return (
    <Section id="notifications" title="Notifications" description="Choose what you want to hear about. Changes save instantly.">
      <div className="divide-y">{(Object.keys(NOTIFICATION_LABEL) as NotificationType[]).map((k) => <Switch key={k} label={NOTIFICATION_LABEL[k]} checked={prefs[k] !== false} onChange={(v) => toggle(k, v)} />)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Push notifications need a push provider and your device permission; in this build alerts appear inside the app.</p>
    </Section>
  );
}

function Personalization() {
  const me = useMe().data!;
  const toast = useToast();
  const [on, setOn] = useState(me.personalization);
  const save = useSend<{ enabled: boolean }, unknown>("PUT", "/me/personalization", { invalidate: ["/auth/me", "/opportunities", "/home", "/feed"], onError: (e) => toast({ kind: "error", title: "Couldn't save", description: e.message }) });
  return (
    <Section id="personalization" title="Personalisation" description="Use your crops, location and activity to suggest posts, buyers, schemes and courses.">
      <Switch label="Personalised suggestions" description="Turn off for a plain, chronological and location-neutral experience. Your data is never sold." checked={on} onChange={(v) => { const p = on; setOn(v); save.mutate({ enabled: v }, { onError: () => setOn(p) }); }} />
    </Section>
  );
}

function Verification() {
  const me = useMe().data!;
  const q = useGet<VerificationStatusDTO>("/me/verification", { staleTime: 0 });
  const toast = useToast();
  const invalidate = useInvalidate();

  const [category, setCategory] = useState<"PROFESSIONAL" | "BUSINESS" | "ORGANIZATION" | "GOVERNMENT">(
    me.role === "GOVERNMENT" ? "GOVERNMENT" : me.role === "FPO" ? "ORGANIZATION" : me.role === "BUYER" ? "BUSINESS" : "PROFESSIONAL"
  );
  const [govCategory, setGovCategory] = useState("DEPARTMENT");
  const [legalName, setLegalName] = useState("");
  const [website, setWebsite] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState("");

  // Email challenge state
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startEmailChallenge = async () => {
    if (!orgEmail || !orgEmail.includes("@")) {
      toast({ title: "Enter a valid official email first", kind: "error" });
      return;
    }
    setSendingOtp(true);
    try {
      const res = await api<{ challengeId: string; demoCode?: string }>("POST", "/me/verification/email/start", { email: orgEmail });
      setChallengeId(res.challengeId);
      if (res.demoCode) {
        toast({ title: "OTP Sent (Demo)", description: `Verification code: ${res.demoCode}` });
      } else {
        toast({ title: "Verification code sent", description: `Check inbox for ${orgEmail}` });
      }
    } catch (err) {
      toast({ title: err instanceof ApiClientError ? err.message : "Failed to send code", kind: "error" });
    } finally {
      setSendingOtp(false);
    }
  };

  const confirmEmailOtp = async () => {
    if (!challengeId || !emailOtp) return;
    setVerifyingOtp(true);
    try {
      await api("POST", "/me/verification/email/verify", { challengeId, code: emailOtp.trim() });
      setEmailVerified(true);
      toast({ title: "Official email verified successfully!" });
    } catch (err) {
      toast({ title: err instanceof ApiClientError ? err.message : "Invalid code", kind: "error" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note || note.trim().length < 10) {
      toast({ title: "Please provide at least 10 characters in your statement", kind: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await api("POST", "/me/verification", {
        category,
        governmentCategory: category === "GOVERNMENT" ? govCategory : undefined,
        legalName: legalName.trim() || undefined,
        website: website.trim() || undefined,
        orgEmail: orgEmail.trim() || undefined,
        registrationNumber: regNumber.trim() || undefined,
        note: note.trim(),
        documentLabels: docs.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
      });
      toast({ title: "Verification request submitted", description: "Our verification team will review your credentials." });
      await invalidate("/me/verification", "/auth/me");
    } catch (err) {
      toast({ title: err instanceof ApiClientError ? err.message : "Submission failed", kind: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (me.role === "ADMIN") return null;
  const s = q.data;

  return (
    <Section id="verification" title="Verification & Authenticity" description="Authenticity seals are verified through government registries, institutional domains, and credential reviews.">
      {q.isLoading ? (
        <ListSkeleton count={1} />
      ) : s?.verified ? (
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm">
          <VerificationBadge badge={s.badge} size="lg" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-foreground">{s.badge?.label ?? "Verified"}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Active</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {s.badge?.aboutText ?? "Your profile has completed official verification."}
            </p>
            {s.badge?.verifiedAt && (
              <p className="text-[11px] text-muted-foreground">
                Verified on {formatDate(s.badge.verifiedAt)}
              </p>
            )}
          </div>
        </div>
      ) : s?.request?.status === "PENDING" ? (
        <div className="space-y-3">
          <Notice tone="info" title="Verification Review in Progress">
            Your verification request for <strong className="font-semibold">{s.request.category ?? s.request.kind}</strong> was submitted on {formatDate(s.request.createdAt)}.
            Our administrators evaluate official credentials to ensure community authenticity.
          </Notice>
          {s.request.challenges && s.request.challenges.length > 0 && (
            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2 text-xs">
              <span className="font-semibold text-foreground">Authentication Challenges:</span>
              <ul className="space-y-1 text-muted-foreground">
                {s.request.challenges.map((ch, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", ch.status === "VERIFIED" ? "bg-emerald-500" : "bg-amber-500")} />
                    <span>{ch.type === "EMAIL" ? "Official Email" : "Domain DNS"}: {ch.target} — <strong>{ch.status}</strong></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {s?.request?.status === "REJECTED" && (
            <Notice tone="warning" title="Previous Request Not Approved">
              {s.request.reviewNote ?? "Please ensure credentials match registered public records before resubmitting."}
            </Notice>
          )}
          {s?.request?.status === "NEEDS_MORE_INFORMATION" && (
            <Notice tone="info" title="Additional Information Requested">
              {s.request.reviewNote ?? "Please provide additional documentation or verify your official email below."}
            </Notice>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">Verification Category</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: "PROFESSIONAL", label: "Professional" },
                  { id: "BUSINESS", label: "Business" },
                  { id: "ORGANIZATION", label: "Organization / FPO" },
                  { id: "GOVERNMENT", label: "Government" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as typeof category)}
                    className={cn(
                      "py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all",
                      category === item.id ? "border-primary bg-primary/10 text-primary font-bold shadow-sm" : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {category === "GOVERNMENT" && (
              <Field label="Government Jurisdiction / Entity Type">
                {(a) => (
                  <Select {...a} value={govCategory} onChange={(e) => setGovCategory(e.target.value)}>
                    <option value="CENTRAL_GOVERNMENT">Central Ministry / Department</option>
                    <option value="STATE_GOVERNMENT">State Government Department</option>
                    <option value="DISTRICT_ADMINISTRATION">District Administration / Collectorate</option>
                    <option value="MUNICIPAL_LOCAL_BODY">Municipal Corporation / Panchayat</option>
                    <option value="PUBLIC_INSTITUTION">Public Autonomous Institution / KVK</option>
                  </Select>
                )}
              </Field>
            )}

            {(category === "ORGANIZATION" || category === "GOVERNMENT" || category === "BUSINESS") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Legal Entity Name" required>
                  {(a) => <Input {...a} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Krishi Vigyan Kendra, Jaipur" />}
                </Field>
                <Field label="Official Registration / CIN / Unique ID">
                  {(a) => <Input {...a} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="e.g. REG-2024-98432" />}
                </Field>
                <Field label="Official Website" hint="Used for domain verification">
                  {(a) => <Input {...a} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://kvkjaipur.gov.in" />}
                </Field>
                <Field label="Official / Institutional Email" hint="Free email services (gmail/yahoo) not allowed for institutions">
                  {(a) => (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input {...a} value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="director@kvkjaipur.gov.in" />
                        {!emailVerified && (
                          <Button type="button" size="sm" variant="outline" loading={sendingOtp} onClick={startEmailChallenge}>
                            Send OTP
                          </Button>
                        )}
                      </div>
                      {challengeId && !emailVerified && (
                        <div className="flex gap-2 pt-1 animate-fade-in">
                          <Input value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} placeholder="6-digit code" className="w-32" />
                          <Button type="button" size="sm" loading={verifyingOtp} onClick={confirmEmailOtp}>
                            Verify Code
                          </Button>
                        </div>
                      )}
                      {emailVerified && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                          ✓ Official email confirmed
                        </span>
                      )}
                    </div>
                  )}
                </Field>
              </div>
            )}

            <Field label="Professional Statement / Organization Overview" hint="Describe your entity, leadership, and public function." required>
              {(a) => <Textarea {...a} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe your credentials, role in the community, and services provided..." />}
            </Field>

            <Field label="Supporting Documents" hint="Comma-separated labels of documents you possess (e.g. Trade License, FPO Registration, Gazette Notification). Never enter raw Aadhaar or PAN numbers.">
              {(a) => <Input {...a} value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="Govt registration letter, Institutional accreditation certificate" />}
            </Field>

            <Button type="submit" loading={submitting}>
              <ShieldCheck className="h-4 w-4" /> Submit for Verification
            </Button>
          </form>
        </div>
      )}
    </Section>
  );
}

function Blocks() {
  const q = useGet<{ kind: "BLOCK" | "MUTE"; user: UserSummary }[]>("/me/blocks", { staleTime: 0 });
  const toast = useToast();
  const un = useSend<string, unknown>("DELETE", (id) => `/me/blocks/${id}`, { invalidate: ["/me/blocks", "/feed", "/conversations"], onSuccess: () => toast({ title: "Removed" }) });
  return (
    <Section id="blocked" title="Blocked and muted" description="Blocked people can't message you or see your posts. Muted people just disappear from your feed.">
      {q.isLoading ? <ListSkeleton count={1} /> : !q.data?.length ? <p className="text-sm text-muted-foreground">You haven&apos;t blocked or muted anyone.</p> : (
        <ul className="divide-y">{q.data.map((b) => <li key={b.user.id} className="flex items-center justify-between gap-3 py-2.5"><span className="flex items-center gap-2.5"><UserAvatar user={b.user} size="sm" /><span className="font-semibold">{b.user.name}</span><Badge tone="neutral">{b.kind === "BLOCK" ? "Blocked" : "Muted"}</Badge></span><Button size="sm" variant="outline" onClick={() => un.mutate(b.user.id)}><UserX className="h-4 w-4" /> Undo</Button></li>)}</ul>
      )}
    </Section>
  );
}

function SignOut() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe().data!;
  return (
    <Section id="session" title="Session">
      {me.demoMode && <Notice tone="info" title="Demo mode">You&apos;re using seeded demo data. Records marked DEMO are samples and can be removed by an admin.</Notice>}
      <Button className="mt-3" variant="outline" onClick={async () => { try { await api("POST", "/auth/logout"); } finally { qc.clear(); router.replace("/"); } }}><LogOut className="h-4 w-4" /> Sign out</Button>
    </Section>
  );
}

const NAV = [["appearance", "Appearance"], ["account", "Account"], ["privacy", "Privacy"], ["notifications", "Notifications"], ["personalization", "Personalisation"], ["verification", "Verification"], ["blocked", "Blocked"], ["session", "Session"]] as const;

export function SettingsView() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <ListSkeleton count={3} />;
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl">Settings</h1>
      <p className="mb-4 text-muted-foreground">Appearance, privacy, notifications and account.</p>
      <nav aria-label="Settings sections" className="scroll-x mb-5 sticky top-14 z-10 -mx-4 bg-background/90 px-4 py-2 backdrop-blur md:static md:mx-0 md:px-0">
        {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className="tap inline-flex shrink-0 items-center rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">{label}</a>)}
      </nav>
      <div className="space-y-5">
        <Appearance />
        <Account />
        <Privacy />
        <Notifications />
        <Personalization />
        <Verification />
        <Blocks />
        <SignOut />
        <p className="text-center text-xs text-muted-foreground"><Link href="/health" className="underline">Health &amp; safety</Link> · KaamSetu never asks for your OTP, Aadhaar or bank PIN.</p>
      </div>
    </div>
  );
}
