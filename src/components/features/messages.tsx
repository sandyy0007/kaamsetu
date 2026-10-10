"use client";
import { ArrowLeft, Ban, MessageSquare, Paperclip, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast";
import { UserAvatar, VerifiedMark } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useGet, useSend } from "@/hooks/use-api";
import { uploadFile } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { profileHref } from "@/lib/links";
import { cn, timeAgo, formatTime } from "@/lib/utils";
import type { ConversationDTO, MessageDTO } from "@/types/dto";
import { ReportButton } from "./actions";
import { useMe } from "@/hooks/use-me";

function ConversationList({ items, active }: { items: ConversationDTO[]; active?: string | null }) {
  return (
    <ul className="divide-y" aria-label="Conversations">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/messages?c=${c.id}`} aria-current={active === c.id ? "page" : undefined} className={cn("flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/60", active === c.id && "bg-muted")}>
            <UserAvatar user={c.other} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", c.unread ? "font-extrabold" : "font-bold")}>{c.other.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.updatedAt)}</span>
              </span>
              {c.context && <span className="block truncate text-xs font-semibold text-primary">{c.context.title}</span>}
              <span className={cn("block truncate text-sm", c.unread ? "text-foreground" : "text-muted-foreground")}>{c.lastMessage?.body ?? "No messages yet"}</span>
            </span>
            {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground" aria-label={`${c.unread} unread`}>{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ id }: { id: string }) {
  const me = useMe().data;
  const toast = useToast();
  const router = useRouter();
  const q = useGet<{ conversation: ConversationDTO; messages: MessageDTO[]; blocked: boolean }>(`/conversations/${id}`, { refetchInterval: 8000, staleTime: 0 });
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSend<{ body: string; attachments?: { name: string; url: string }[] }, MessageDTO>("POST", `/conversations/${id}/messages`, {
    invalidate: ["/conversations"],
    onSuccess: () => {
      setText("");
      setFiles([]);
    },
    onError: (e) => toast({ kind: "error", title: "Message not sent", description: e.message }),
  });
  const count = q.data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, id]);
  const attach = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const file = f.type.startsWith("image/") ? await compressImage(f) : f;
      const r = await uploadFile(file);
      setFiles((x) => [...x, { name: f.name.slice(0, 80), url: r.url }].slice(0, 3));
    } catch (e) {
      toast({ kind: "error", title: "Couldn't attach file", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  if (q.isLoading) return <div className="p-4"><ListSkeleton count={3} /></div>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} title="Conversation not found" />;
  const { conversation: c, messages, blocked } = q.data;
  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate({ body, attachments: files.length ? files : undefined });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-3">
        <button onClick={() => router.push("/messages")} className="tap grid place-items-center rounded-xl lg:hidden" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <UserAvatar user={c.other} />
        <div className="min-w-0 flex-1">
          <Link href={profileHref(c.other)} className="flex items-center gap-1 font-bold hover:underline">
            <span className="truncate">{c.other.name}</span>
            {c.other.verified && <VerifiedMark />}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{c.other.headline ?? c.context?.title}</p>
        </div>
        <ReportButton targetType="USER" targetId={c.other.id} label="Report" />
      </header>
      {c.context && (
        <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          About: <span className="font-semibold text-foreground">{c.context.title}</span>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Messages">
        <Notice tone="info">
          Never share OTPs, passwords, bank or UPI details in chat. KaamSetu does not process payments — settle deals offline, and meet in public places.
        </Notice>
        {messages.map((m) => {
          const mine = m.senderId === me?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm", mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.attachments.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-semibold underline", mine ? "text-primary-foreground" : "text-primary")}>
                    <Paperclip className="h-3.5 w-3.5" aria-hidden /> {a.name}
                  </a>
                ))}
                <p className={cn("mt-1 text-[11px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {formatTime(m.createdAt)}
                  {mine && m.read ? " · Seen" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {blocked ? (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Ban className="h-4 w-4" aria-hidden /> You can&apos;t send messages in this conversation.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="border-t p-3"
        >
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <Badge key={f.url} tone="neutral" className="gap-1.5">
                  {f.name}
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.url !== f.url))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void attach(e.target.files?.[0])} />
            <Button type="button" variant="ghost" size="icon" aria-label="Attach a photo or PDF" loading={uploading} disabled={files.length >= 3} onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
            </Button>
            <label className="sr-only" htmlFor="msg-input">Message</label>
            <textarea
              id="msg-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Write a message…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border bg-card px-3.5 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim()} loading={send.isPending}>
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function MessagesView() {
  const sp = useSearchParams();
  const active = sp.get("c");
  const q = useGet<ConversationDTO[]>("/conversations", { refetchInterval: 15000 });
  return (
    <div>
      <h1 className="sr-only">Messages</h1>
      <Card className="grid h-[calc(100dvh-9.5rem)] min-h-[28rem] overflow-hidden lg:h-[calc(100dvh-6rem)] lg:grid-cols-[22rem_1fr]">
        <section aria-label="Conversation list" className={cn("min-h-0 flex-col overflow-y-auto border-r", active ? "hidden lg:flex" : "flex")}>
          <div className="border-b px-4 py-3.5">
            <h2 className="text-lg">Messages</h2>
          </div>
          {q.isLoading ? (
            <div className="p-4"><ListSkeleton count={4} /></div>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : !q.data?.length ? (
            <EmptyState compact icon={<MessageSquare className="h-7 w-7" />} title="No conversations yet" description="Message a buyer, farmer or expert from their profile or a produce listing." action={{ label: "Find people", href: "/explore" }} />
          ) : (
            <ConversationList items={q.data} active={active} />
          )}
        </section>
        <section aria-label="Conversation" className={cn("min-h-0", active ? "block" : "hidden lg:block")}>
          {active ? <Thread key={active} id={active} /> : <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Select a conversation" description="Your private messages appear here." />}
        </section>
      </Card>
    </div>
  );
}
