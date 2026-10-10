"use client";
import { Award, BookOpen, CheckCircle2, Circle, Clock, FileText, GraduationCap, PlayCircle, Printer, ShieldCheck, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Notice, PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { ChipRow } from "@/components/ui/tabs";
import { ToggleChip } from "./filters";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { roleCan } from "@/lib/capabilities";
import { ButtonLink } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { CourseCardDTO, CourseDetailDTO, ModuleDTO } from "@/types/dto";
import { CourseCard } from "./cards";
import { SearchField, useDebounced } from "./filters";

export function LearningView() {
  const me = useMe().data;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const dq = useDebounced(q.trim());
  // Professionals see courses for their own trade first; anyone can switch to the full catalogue.
  const [forMe, setForMe] = useState<boolean | null>(null);
  const mineOnly = forMe ?? me?.role === "PROFESSIONAL";
  const all = useGet<CourseCardDTO[]>(me ? `/courses${mineOnly ? "?for=me" : ""}` : null, { keepPrevious: true });
  const cats = useMemo(() => [...new Set((all.data ?? []).map((c) => c.category))], [all.data]);
  const items = (all.data ?? []).filter((c) => (!cat || c.category === cat) && (!dq || `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(dq.toLowerCase())));
  const inProgress = items.filter((c) => c.progressPct > 0 && !c.completed);
  return (
    <div>
      <PageHeader title="Learning hub" subtitle="Short courses for your trade — crops, soil, machinery, tools, safety and money — with quizzes and certificates." actions={me && roleCan(me.role, "course:create") ? <ButtonLink href="/create?type=course">Create a course</ButtonLink> : undefined} />
      <div className="mb-5 space-y-3">
        <SearchField value={q} onChange={setQ} label="Search courses" placeholder="Search courses" />
        {cats.length > 0 && <ChipRow label="Course category" items={cats} value={cat} onChange={setCat} all="All" />}
        {me && (
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip on={mineOnly} onChange={setForMe}>
              Relevant to my profession
            </ToggleChip>
            <span className="text-xs text-muted-foreground">{mineOnly ? "Showing courses for your profession and general skills." : "Showing every course."}</span>
          </div>
        )}
      </div>
      {all.isLoading || !me ? (
        <ListSkeleton count={3} media />
      ) : all.isError ? (
        <Card><ErrorState error={all.error} onRetry={() => void all.refetch()} /></Card>
      ) : !items.length ? (
        <Card><EmptyState icon={<GraduationCap className="h-7 w-7" />} title="No courses found" description="Try another search or category — or switch off “Relevant to my profession”." /></Card>
      ) : (
        <div className="space-y-8">
          {inProgress.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg">Continue learning</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{inProgress.map((c) => <CourseCard key={c.id} c={c} />)}</div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg">All courses</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          </section>
        </div>
      )}
    </div>
  );
}

interface QuizResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  results: { id: string; correct: boolean; correctIndex: number }[];
  course: CourseDetailDTO;
}

function Quiz({ course, mod, onDone }: { course: CourseDetailDTO; mod: ModuleDTO; onDone: (c: CourseDetailDTO) => void }) {
  const toast = useToast();
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const qs = mod.quiz ?? [];
  useEffect(() => {
    setAnswers([]);
    setResult(null);
  }, [mod.id]);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<QuizResult>("POST", `/courses/${course.id}/quiz/${mod.id}`, { answers });
      setResult(r);
      if (r.passed) onDone(r.course);
    } catch (e) {
      toast({ kind: "error", title: "Couldn't submit quiz", description: e instanceof ApiClientError ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const complete = answers.length === qs.length && qs.every((_, i) => answers[i] !== undefined);
  return (
    <div className="space-y-5">
      {qs.map((q, qi) => {
        const res = result?.results[qi];
        return (
          <fieldset key={q.id} className="rounded-2xl border p-4" disabled={!!result?.passed}>
            <legend className="px-1 text-sm font-bold">{qi + 1}. {q.question}</legend>
            <div className="mt-2 space-y-2">
              {q.options.map((o, oi) => {
                const picked = answers[qi] === oi;
                const show = result && !result.passed ? (res?.correctIndex === oi ? "right" : picked ? "wrong" : "") : result?.passed ? (res?.correctIndex === oi ? "right" : "") : "";
                return (
                  <label key={oi} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors", picked && "border-primary bg-primary/8", show === "right" && "border-success bg-success/10", show === "wrong" && "border-danger bg-danger/10")}>
                    <input type="radio" name={`${mod.id}-${q.id}`} className="h-4 w-4 accent-[hsl(var(--primary))]" checked={picked} onChange={() => setAnswers((a) => { const n = [...a]; n[qi] = oi; return n; })} />
                    {o}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {result && (
        <Notice tone={result.passed ? "success" : "warning"} title={result.passed ? `Passed — ${result.score}%` : `Score ${result.score}% — you need 60% to pass`}>
          {result.passed ? `You got ${result.correct} of ${result.total} right. This lesson is complete.` : "The correct answers are highlighted. Review the lesson and try again."}
        </Notice>
      )}
      {!result?.passed && (
        <Button onClick={submit} loading={busy} disabled={!complete}>
          {result ? "Try again" : "Submit answers"}
        </Button>
      )}
    </div>
  );
}

function Certificate({ c }: { c: NonNullable<CourseDetailDTO["certificate"]> & { course: string } }) {
  return (
    <div className="print-area rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/8 via-card to-accent/8 p-6 text-center sm:p-10">
      <Award className="mx-auto h-12 w-12 text-accent" aria-hidden />
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Certificate of completion</p>
      <p className="mt-4 text-sm text-muted-foreground">This certifies that</p>
      <p className="mt-1 text-3xl font-extrabold">{c.holder}</p>
      <p className="mt-3 text-sm text-muted-foreground">has successfully completed</p>
      <p className="mt-1 text-xl font-bold">{c.course}</p>
      <p className="mt-5 text-sm text-muted-foreground">Issued {formatDate(c.issuedAt)} on KaamSetu</p>
      <p className="mt-2 font-mono text-xs">Verification code: <span className="font-bold">{c.code}</span></p>
      <p className="mt-3 text-[11px] text-muted-foreground">Verify at /api/certificates/verify/{c.code}. A KaamSetu course certificate is not a government or university qualification.</p>
    </div>
  );
}

export function CourseDetail({ id }: { id: string }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const q = useGet<CourseDetailDTO>(`/courses/${id}`);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const course = q.data;
  const active = useMemo(() => {
    if (!course) return null;
    return course.modules.find((m) => m.id === activeId) ?? course.modules.find((m) => !m.done) ?? course.modules[0] ?? null;
  }, [course, activeId]);
  if (q.isLoading) return <ListSkeleton count={2} media />;
  if (q.isError || !course) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Course not found" /></Card>;
  const done = course.modules.filter((m) => m.done).length;
  const refresh = (c: CourseDetailDTO) => {
    q.refetch().catch(() => undefined);
    void invalidate("/courses", "/certificates", "/notifications");
    if (c.certificate && !course.certificate) toast({ title: "Certificate earned", description: "Scroll down to view and print it." });
  };
  const complete = async (m: ModuleDTO) => {
    setBusy(true);
    try {
      const c = await api<CourseDetailDTO>("POST", `/courses/${course.id}/complete`, { moduleId: m.id });
      refresh(c);
      const next = c.modules.find((x) => !x.done);
      if (next) setActiveId(next.id);
    } catch (e) {
      toast({ kind: "error", title: "Couldn't save progress", description: e instanceof ApiClientError ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const KindIcon = ({ k }: { k: ModuleDTO["kind"] }) => (k === "VIDEO" ? <PlayCircle className="h-4 w-4" /> : k === "QUIZ" ? <HelpCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />);
  return (
    <div className="space-y-6">
      <Link href="/learning" className="text-sm font-semibold text-primary hover:underline">← All courses</Link>
      <Card className="overflow-hidden">
        <div className="grid sm:grid-cols-[16rem_1fr]">
          <div className="h-36 sm:h-auto"><Scene kind={course.scene} /></div>
          <div className="p-5">
            <div className="flex flex-wrap gap-1.5"><Badge tone="primary">{course.category}</Badge><Badge tone="outline">{course.level}</Badge>{course.completed && <Badge tone="success">Completed</Badge>}</div>
            <h1 className="mt-2 text-2xl">{course.title}</h1>
            <p className="mt-1 text-muted-foreground">{course.description}</p>
            <p className="mt-2 flex items-center gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{course.modules.length} lessons</span><span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{course.totalMinutes} min</span><span>By {course.author.name}</span></p>
            <div className="mt-4"><Progress value={course.progressPct} label="Course progress" tone={course.completed ? "success" : "primary"} /><p className="mt-1 text-xs text-muted-foreground">{done} of {course.modules.length} lessons done</p></div>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Lessons">
          <Card className="overflow-hidden">
            <ol className="divide-y">
              {course.modules.map((m, i) => (
                <li key={m.id}>
                  <button onClick={() => setActiveId(m.id)} aria-current={active?.id === m.id ? "step" : undefined} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60", active?.id === m.id && "bg-muted")}>
                    {m.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Completed" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className="min-w-0"><span className="block font-semibold">{i + 1}. {m.title}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><KindIcon k={m.kind} /> {m.kind === "QUIZ" ? "Quiz" : m.kind === "VIDEO" ? "Video" : "Article"} · {m.durationMin} min</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        </nav>
        <div className="space-y-6">
          {active ? (
            <Card className="p-5">
              <h2 className="text-xl">{active.title}</h2>
              {active.kind === "VIDEO" && <Notice tone="info">Video playback is not connected in this demo build. The lesson notes are below.</Notice>}
              {active.kind !== "QUIZ" ? (
                <>
                  <div className="prose-ks mt-3 whitespace-pre-line leading-relaxed">{active.body}</div>
                  <div className="mt-5">
                    {active.done ? <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> Lesson complete</Badge> : <Button onClick={() => void complete(active)} loading={busy}><CheckCircle2 className="h-4 w-4" /> Mark as complete</Button>}
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  {active.body && <p className="mb-4 whitespace-pre-line text-muted-foreground">{active.body}</p>}
                  {active.done && <Badge tone="success" className="mb-3"><CheckCircle2 className="h-3.5 w-3.5" /> Quiz passed</Badge>}
                  <Quiz course={course} mod={active} onDone={refresh} />
                </div>
              )}
            </Card>
          ) : (
            <Card><EmptyState title="No lessons yet" /></Card>
          )}
          {course.outcomes.length > 0 && (
            <Card className="p-5"><h2 className="text-base">What you&apos;ll learn</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{course.outcomes.map((o) => <li key={o}>{o}</li>)}</ul></Card>
          )}
          {course.certificate && (
            <section aria-label="Certificate">
              <Certificate c={{ ...course.certificate, course: course.title }} />
              <div className="mt-3 flex justify-end"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print or save as PDF</Button></div>
            </section>
          )}
          {!course.certificate && <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Complete every lesson to earn a verifiable certificate.</p>}
        </div>
      </div>
    </div>
  );
}
