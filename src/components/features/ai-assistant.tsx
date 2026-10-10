"use client";
import { ArrowRight, Bot, Send, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast";
import { useI18n } from "@/components/providers/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import type { AIMessageDTO } from "@/types/dto";
import { VoiceButton } from "./voice-button";

const FARM_STARTERS = ["Which scheme can I apply for?", "Mere sarson ka rate kya hai?", "Find wheat buyers near me", "How do I improve my Farm Health Score?", "Sarson mein keede lage hain, kya karun?", "Show learning courses on drip irrigation"];
const PRO_STARTERS = ["Find work near me", "Electrician near Churu", "Which scheme can I apply for?", "Help me write about my work", "Show skill training courses", "How do I get more service requests?"];

interface History {
  conversationId: string | null;
  messages: AIMessageDTO[];
}

export function AiAssistantView() {
  const sp = useSearchParams();
  const toast = useToast();
  const { lang } = useI18n();
  const me = useMe().data;
  const STARTERS = me?.role === "PROFESSIONAL" && me.profession?.id !== "pr_farmer" ? PRO_STARTERS : FARM_STARTERS;
  const invalidate = useInvalidate();
  const history = useGet<History>("/ai/history", { staleTime: 0 });
  const [text, setText] = useState(sp.get("q") ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [convoId, setConvoId] = useState<string | undefined>();
  const [extra, setExtra] = useState<AIMessageDTO[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const base = history.data?.messages ?? [];
  const all = [...base, ...extra.filter((e) => !base.some((b) => b.id === e.id))];
  useEffect(() => {
    if (history.data?.conversationId) setConvoId(history.data.conversationId);
  }, [history.data?.conversationId]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [all.length, pending]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || pending) return;
    setPending(message);
    setText("");
    try {
      const r = await api<{ conversationId: string; reply: AIMessageDTO }>("POST", "/ai/chat", { message, conversationId: convoId, locale: lang });
      setConvoId(r.conversationId);
      await history.refetch();
      setExtra([]);
    } catch (e) {
      setText(message);
      toast({ kind: "error", title: "The assistant couldn't answer", description: e instanceof ApiClientError ? e.message : "Check your connection and try again." });
    } finally {
      setPending(null);
    }
  };
  const clear = async () => {
    try {
      await api("DELETE", "/ai/history");
      setConvoId(undefined);
      setExtra([]);
      await invalidate("/ai");
      toast({ title: "Conversation cleared" });
    } catch {
      toast({ kind: "error", title: "Couldn't clear the conversation" });
    }
  };
  const last = all[all.length - 1];
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="flex h-[calc(100dvh-9.5rem)] min-h-[28rem] flex-col overflow-hidden lg:h-[calc(100dvh-6rem)]">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Bot className="h-5 w-5" aria-hidden /></span>
            <div><h1 className="text-lg">KaamSetu Assistant</h1><p className="text-xs text-muted-foreground">Hindi · English · Hinglish</p></div>
          </div>
          {all.length > 0 && <Button variant="ghost" size="sm" onClick={clear}><Trash2 className="h-4 w-4" /> Clear</Button>}
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation">
          <Notice tone="warning">
            I&apos;m an AI helper, not a doctor, vet or legal adviser. For health emergencies call 112/108. For prices and schemes, I show what&apos;s in KaamSetu — always confirm with official sources. I never need your OTP, Aadhaar or bank details.
          </Notice>
          {history.isLoading ? <ListSkeleton count={2} /> : history.isError ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : !all.length && !pending ? (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-accent" aria-hidden />
              <p className="mt-2 font-bold">Ask me anything about your work</p>
              <p className="mt-1 text-sm text-muted-foreground">Type or tap the microphone and speak in Hindi, English or Hinglish.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => <button key={s} onClick={() => void send(s)} className="tap rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">{s}</button>)}
              </div>
            </div>
          ) : null}
          {all.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] rounded-2xl px-4 py-3 text-sm", m.role === "USER" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
                <p className="whitespace-pre-line break-words">{m.content}</p>
                {m.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.actions.map((a) => <Link key={a.href + a.label} href={a.href} className="tap inline-flex items-center gap-1.5 rounded-xl bg-primary/12 px-3 text-sm font-bold text-primary hover:bg-primary/20">{a.label} <ArrowRight className="h-4 w-4" aria-hidden /></Link>)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending && (
            <>
              <div className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{pending}</div></div>
              <div className="flex" role="status" aria-label="Assistant is typing"><div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3"><span className="inline-flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />)}</span></div></div>
            </>
          )}
          {!pending && last?.role === "ASSISTANT" && last.followUps.length > 0 && (
            <div className="flex flex-wrap gap-2">{last.followUps.map((f) => <button key={f} onClick={() => void send(f)} className="tap rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">{f}</button>)}</div>
          )}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="border-t p-3">
          <div className="flex items-end gap-2">
            <label htmlFor="ai-input" className="sr-only">Message the assistant</label>
            <textarea id="ai-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} rows={1} maxLength={1000} placeholder="Ask in Hindi or English…" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border bg-card px-3.5 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <VoiceButton onText={(t) => setText(t)} />
            <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || !!pending} loading={!!pending}><Send className="h-5 w-5" /></Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
