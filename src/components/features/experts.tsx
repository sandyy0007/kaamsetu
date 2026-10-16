"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle, Plus, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader, Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, QueryBoundary } from "@/components/ui/state";
import { Tabs, ChipRow } from "@/components/ui/tabs";
import { flatten, useGet, useInfiniteList, useInvalidate } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { CROPS } from "@/lib/constants";
import { questionSchema, answerSchema, type QuestionInput } from "@/lib/schemas";
import { cn, timeAgo } from "@/lib/utils";
import { QUESTION_CATEGORIES } from "@/types/domain";
import type { ExpertCardDTO, QuestionDTO } from "@/types/dto";
import { CommentThread } from "./social";
import { FilterPanel, SearchField, useDebounced } from "./filters";
import { QuestionCard } from "@/components/features/cards";
import { ExpertCard, UserLine } from "./people";
import { ImagePicker } from "./image-picker";
import { VoiceButton } from "./voice-button";
import { ExpertProfileView } from "./other-profiles";

function AskSheet({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults: { crop?: string; expertId?: string } }) {
  const toast = useToast();
  const router = useRouter();
  const invalidate = useInvalidate();
  const [image, setImage] = useState<string | undefined>();
  const { register, handleSubmit, formState, setError, setValue, watch, reset } = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: { category: "Crop", body: "", crop: defaults.crop ?? "", district: "", expertId: defaults.expertId ?? "" },
  });
  useEffect(() => {
    if (open) reset({ category: "Crop", body: "", crop: defaults.crop ?? "", district: "", expertId: defaults.expertId ?? "" });
  }, [open, defaults.crop, defaults.expertId, reset]);
  const body = watch("body") ?? "";
  const submit = handleSubmit(async (v) => {
    try {
      const q = await api<QuestionDTO>("POST", "/questions", { ...v, imageUrl: image });
      await invalidate("/questions", "/experts");
      toast({ title: "Question posted", description: "An expert will reply here. You'll get a notification." });
      setImage(undefined);
      onClose();
      router.push(`/experts/questions/${q.id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof QuestionInput, { message: m });
      else setError("body", { message: e instanceof ApiClientError ? e.message : "Couldn't post your question" });
    }
  });
  return (
    <Sheet open={open} onClose={onClose} title="Ask an expert" description="Describe the problem. A photo helps a lot." size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={formState.isSubmitting}>Post question</Button></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Notice tone="warning" title="Emergencies">
          For snake-bite, poisoning, serious injury or heat stroke call <strong>112</strong> or <strong>108</strong> now — don&apos;t wait for an answer. <Link href="/health" className="font-semibold underline">Open health & safety guide</Link>
        </Notice>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic" required error={formState.errors.category?.message}>
            {(a) => (
              <Select {...a} {...register("category")}>
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Crop (optional)" error={formState.errors.crop?.message}>
            {(a) => (
              <>
                <Input {...a} {...register("crop")} list="crop-options" placeholder="e.g. Mustard" />
                <datalist id="crop-options">
                  {CROPS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>
        <Field label="Your question" required error={formState.errors.body?.message} hint={`${body.length}/1200 — include crop stage, what you see, and for how many days.`}>
          {(a) => (
            <div className="relative">
              <Textarea {...a} {...register("body")} rows={5} maxLength={1200} className="pr-12" placeholder="e.g. My mustard leaves are turning yellow since 5 days after the first irrigation…" />
              <VoiceButton className="absolute right-1.5 top-1.5 h-9 w-9 min-h-0 min-w-0" label="Speak your question" onText={(t) => setValue("body", t, { shouldValidate: true })} />
            </div>
          )}
        </Field>
        <Field label="District (optional)" error={formState.errors.district?.message}>
          {(a) => <Input {...a} {...register("district")} placeholder="e.g. Churu" />}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Photo (optional)</p>
          <ImagePicker value={image} onChange={setImage} label="Take or choose a photo of the problem" />
        </div>
        {defaults.expertId && <p className="text-sm text-muted-foreground">This question will be sent to the expert you selected.</p>}
      </form>
    </Sheet>
  );
}

function QuestionsTab() {
  const sp = useSearchParams();
  const { data: me } = useMe();
  const [scope, setScope] = useState<string>(me?.role === "EXPERT" ? "forMe" : "");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const dq = useDebounced(q);
  const [ask, setAsk] = useState(sp.get("ask") === "1");
  const list = useInfiniteList<QuestionDTO>("/questions", { scope, status, q: dq, category, crop: sp.get("crop") ?? "" });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const canAsk = me?.role === "FARMER" || me?.role === "FPO" || me?.role === "BUYER";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchField value={q} onChange={setQ} label="Search questions" placeholder="Search questions, e.g. yellow leaves" />
        </div>
        {canAsk && (
          <Button onClick={() => setAsk(true)}>
            <Plus className="h-4 w-4" /> Ask a question
          </Button>
        )}
      </div>
      <FilterPanel>
        <Select aria-label="Show" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">All questions</option>
          <option value="mine">My questions</option>
          {me?.role === "EXPERT" && <option value="forMe">For me to answer</option>}
        </Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="OPEN">Awaiting an expert</option>
          <option value="ANSWERED">Answered</option>
        </Select>
        <Select aria-label="Topic" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any topic</option>
          {QUESTION_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </FilterPanel>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No questions found" icon={<HelpCircle className="h-7 w-7" />} description={canAsk ? "Be the first to ask — experts reply here." : "Try changing the filters."} action={canAsk ? { label: "Ask a question", onClick: () => setAsk(true) } : undefined} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((x) => (
              <QuestionCard key={x.id} q={x} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
      <AskSheet open={ask} onClose={() => setAsk(false)} defaults={{ crop: sp.get("crop") ?? undefined, expertId: sp.get("expert") ?? undefined }} />
    </div>
  );
}

const EXPERT_CATS = ["Agronomist", "Veterinarian", "Soil Expert", "Researcher", "KVK Expert"] as const;

function ExpertsTab() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const dq = useDebounced(q);
  const list = useInfiniteList<ExpertCardDTO>("/experts", { q: dq, category: cat });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  return (
    <div className="space-y-4">
      <SearchField value={q} onChange={setQ} label="Search experts" placeholder="Search by name, speciality or place" />
      <ChipRow items={EXPERT_CATS} all="All experts" value={cat} onChange={(v) => setCat(v)} label="Expert category" />
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No experts found" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((e) => (
              <ExpertCard key={e.user.id} e={e} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

export function ExpertsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const expertId = sp.get("id");
  if (expertId) {
    return <ExpertProfileView id={expertId} />;
  }
  const tab = sp.get("tab") === "questions" ? "questions" : "experts";
  const setTab = (t: "experts" | "questions") => router.replace(`/experts?tab=${t}`);
  return (
    <div>
      <PageHeader title="Experts & questions" subtitle="Agronomists, veterinarians, soil scientists and extension officers. Ask and learn." />
      <Tabs label="Experts sections" value={tab} onChange={setTab} items={[{ id: "experts", label: "Experts" }, { id: "questions", label: "Questions" }]} className="mb-5" />
      {tab === "experts" ? <ExpertsTab /> : <QuestionsTab />}
    </div>
  );
}

export function QuestionDetail({ id }: { id: string }) {
  const q = useGet<QuestionDTO>(`/questions/${id}`);
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const toast = useToast();
  const form = useForm<{ body: string }>({ resolver: zodResolver(answerSchema), defaultValues: { body: "" } });
  const submit = form.handleSubmit(async (v) => {
    try {
      await api("POST", `/questions/${id}/answers`, v);
      form.reset();
      await invalidate("/questions");
      toast({ title: "Answer posted" });
    } catch (e) {
      form.setError("body", { message: e instanceof ApiClientError ? e.message : "Couldn't post the answer" });
    }
  });
  const helpful = async (answerId: string) => {
    try {
      await api("POST", `/answers/${answerId}/helpful`);
      await invalidate("/questions");
    } catch {
      toast({ kind: "error", title: "Couldn't mark as helpful" });
    }
  };
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={2} />}>
      {(x) => (
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href="/experts?tab=questions" className="text-sm font-semibold text-primary hover:underline">
            ← All questions
          </Link>
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="accent">{x.category}</Badge>
              {x.crop && <Badge tone="neutral">{x.crop}</Badge>}
              {x.district && <Badge tone="outline">{x.district}</Badge>}
              <Badge tone={x.status === "ANSWERED" ? "success" : "warning"}>{x.status === "ANSWERED" ? "Answered" : "Awaiting an expert"}</Badge>
              {x.isDemo && <DemoBadge />}
            </div>
            <p className="whitespace-pre-wrap text-lg leading-relaxed">{x.body}</p>
            {x.imageUrl && <img src={x.imageUrl} alt="Photo attached to the question" className="mt-4 max-h-96 w-auto max-w-full rounded-xl border object-contain" />}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <UserLine user={x.asker} size="sm" sub={`Asked ${timeAgo(x.createdAt)}`} />
            </div>
          </Card>
          <section aria-labelledby="answers-h" className="space-y-3">
            <h2 id="answers-h" className="text-lg">
              {x.answers.length} answer{x.answers.length === 1 ? "" : "s"}
            </h2>
            {x.answers.length === 0 && (
              <Card>
                <EmptyState compact title="No expert has answered yet" description="You'll be notified when someone replies." />
              </Card>
            )}
            {x.answers.map((a) => (
              <Card key={a.id} className="border-success/40 p-5">
                <UserLine user={a.expert} size="sm" time={a.createdAt} />
                <p className="mt-3 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button onClick={() => helpful(a.id)} aria-pressed={a.markedHelpful} className={cn("tap inline-flex items-center gap-2 rounded-xl border px-3 text-sm font-semibold", a.markedHelpful ? "border-success bg-success/12 text-success" : "hover:bg-muted")}>
                    <ThumbsUp className="h-4 w-4" /> Helpful · {a.helpful}
                  </button>
                  <p className="text-xs text-muted-foreground">General advice from a verified expert — not a diagnosis. Check with a local KVK for field-specific decisions.</p>
                </div>
              </Card>
            ))}
          </section>
          {me?.role === "EXPERT" && (
            <Card className="p-5">
              <h2 className="mb-2 text-lg">Your answer</h2>
              <form onSubmit={submit} noValidate className="space-y-3">
                <Field label="Answer" error={form.formState.errors.body?.message} required>
                  {(a) => <Textarea {...a} {...form.register("body")} rows={5} placeholder="Share practical, safe, step-by-step advice…" />}
                </Field>
                <Button type="submit" loading={form.formState.isSubmitting}>
                  Post answer
                </Button>
              </form>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 text-lg">Discussion</h2>
            <CommentThread targetType="QUESTION" targetId={x.id} />
          </Card>
        </div>
      )}
    </QueryBoundary>
  );
}
