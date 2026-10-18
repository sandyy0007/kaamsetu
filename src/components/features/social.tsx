"use client";
import { MessageCircle, Send, Trash2, Megaphone, Play, Users } from "lucide-react";
import Link from "next/link";
import { useState, Fragment } from "react";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError, resolveMediaUrl } from "@/lib/api";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import type { CommentDTO, PostDTO, ReelDTO, StoryDTO } from "@/types/dto";
import { LikeButton, ReportButton, SaveButton, ShareButton, FollowButton } from "./actions";
import { UserLine } from "./people";
import { UserAvatar } from "@/components/ui/avatar";
import { profileHref } from "@/lib/links";

const KIND_LABEL: Record<string, string> = { TIP: "Tip", ANNOUNCEMENT: "Announcement", EVENT: "Event", STORY: "Story", MARKET: "Market update", WEATHER: "Weather", QUESTION: "Question", EXPERT_ANSWER: "Expert answer" };

/** Renders text with #hashtags linked to search. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(#[\p{L}\p{M}\p{N}_]+)/u);
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((p, i) =>
        p.startsWith("#") ? (
          <Link key={i} href={`/explore?q=${encodeURIComponent(p)}`} className="font-semibold text-primary hover:underline">
            {p}
          </Link>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

export function CommentThread({ targetType, targetId, onCount }: { targetType: "POST" | "REEL" | "QUESTION"; targetId: string; onCount?: (n: number) => void }) {
  const path = `/comments?targetType=${targetType}&targetId=${targetId}`;
  const q = useGet<CommentDTO[]>(path);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    try {
      await api("POST", "/comments", { targetType, targetId, body });
      setText("");
      await invalidate("/comments");
      onCount?.((q.data?.length ?? 0) + 1);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Couldn't post your comment");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api("DELETE", `/comments/${id}`);
      await invalidate("/comments");
      onCount?.(Math.max(0, (q.data?.length ?? 1) - 1));
    } catch {
      toast({ kind: "error", title: "Couldn't delete the comment" });
    }
  };
  return (
    <div className="space-y-3">
      {q.isLoading && <Skeleton className="h-12" />}
      {q.isError && <p className="text-sm text-danger">Couldn&apos;t load comments. <button className="font-semibold underline" onClick={() => void q.refetch()}>Retry</button></p>}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet. Be the first to reply.</p>}
      <ul className="space-y-3">
        {q.data?.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <UserAvatar user={c.author} size="sm" />
            <div className="min-w-0 flex-1 rounded-2xl bg-muted/70 px-3 py-2">
              <p className="flex items-center justify-between gap-2 text-sm">
                <Link href={profileHref(c.author)} className="font-bold hover:underline">
                  {c.author.name}
                </Link>
                <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              <div className="mt-1 flex gap-1">
                {c.isOwn ? (
                  <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                ) : (
                  <ReportButton targetType="COMMENT" targetId={c.id} className="!min-h-0 !px-0 text-xs" />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex-1">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" aria-label="Write a comment" maxLength={600} aria-invalid={err ? true : undefined} />
          {err && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {err}
            </p>
          )}
        </div>
        <Button type="submit" size="icon" loading={busy} disabled={!text.trim()} aria-label="Send comment">
          {!busy && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

export function PostCard({ post, onDeleted, compact }: { post: PostDTO; onDeleted?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cc, setCc] = useState(post.commentCount);
  const [imgError, setImgError] = useState(false);
  const toast = useToast();
  const invalidate = useInvalidate();
  const remove = async () => {
    try {
      await api("DELETE", `/posts/${post.id}`);
      toast({ title: "Post deleted" });
      await invalidate("/feed", "/home", "/farmers", "/posts");
      onDeleted?.();
    } catch {
      toast({ kind: "error", title: "Couldn't delete the post" });
    }
  };
  return (
    <Card className="overflow-hidden">
      <article aria-label={`Post by ${post.author.name}`}>
        <div className="flex items-start justify-between gap-2 p-4 pb-3">
          <UserLine user={post.author} sub={[post.author.headline, post.district].filter(Boolean).join(" · ") || undefined} time={post.createdAt} />
          <div className="flex shrink-0 items-center gap-1">
            {!post.isOwn && !compact && <FollowButton userId={post.author.id} following={post.followingAuthor} />}
            {post.isOwn ? (
              <button onClick={remove} aria-label="Delete post" className="tap grid place-items-center rounded-xl text-muted-foreground hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <ReportButton targetType="POST" targetId={post.id} />
            )}
          </div>
        </div>
        <div className="px-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {post.official && (
              <Badge tone="info">
                <Megaphone className="h-3 w-3" aria-hidden /> Official
              </Badge>
            )}
            {post.kind !== "POST" && <Badge tone="accent">{KIND_LABEL[post.kind] ?? post.kind}</Badge>}
            {post.community && (
              <Link href={`/communities/${post.community.id}`}>
                <Badge tone="primary">
                  <Users className="h-3 w-3" aria-hidden /> {post.community.name}
                </Badge>
              </Link>
            )}
            {post.crop && <Badge tone="neutral">{post.crop}</Badge>}
            {post.isDemo && <DemoBadge />}
          </div>
          <RichText text={post.body} />
        </div>
        {(post.imageUrl || post.scene) && (
          <div className="mt-3 aspect-[5/3] overflow-hidden bg-muted">
            {post.imageUrl && !imgError ? (
              <img
                src={resolveMediaUrl(post.imageUrl)}
                alt=""
                loading="lazy"
                onError={() => {
                  console.warn("[KaamSetu:Media:PostImageError]", { postId: post.id, url: post.imageUrl });
                  setImgError(true);
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <Scene kind={post.scene ?? "sunrise"} />
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center">
            <LikeButton targetType="POST" targetId={post.id} liked={post.liked} count={post.likeCount} />
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="tap inline-flex items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <MessageCircle className="h-6 w-6" aria-hidden />
              <span className="tabular-nums">{cc}</span>
              <span className="sr-only">comments</span>
            </button>
            <ShareButton title={post.body.slice(0, 60)} path={`/home?post=${post.id}`} />
          </div>
          <SaveButton targetType="POST" targetId={post.id} saved={post.saved} />
        </div>
        {open && (
          <div className="border-t bg-muted/30 p-4">
            <CommentThread targetType="POST" targetId={post.id} onCount={setCc} />
          </div>
        )}
      </article>
    </Card>
  );
}

export function ReelThumb({ reel, className }: { reel: ReelDTO; className?: string }) {
  return (
    <Link href={`/reels?r=${reel.id}`} className={cn("group relative block aspect-[9/14] overflow-hidden rounded-2xl border bg-muted shadow-card", className)}>
      <Scene kind={reel.scene} className="transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
        <Play className="h-3 w-3 fill-current" aria-hidden /> {Math.floor(reel.durationSec / 60)}:{String(reel.durationSec % 60).padStart(2, "0")}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{reel.caption}</p>
        <p className="mt-0.5 truncate text-xs text-white/80">{reel.author.name}</p>
      </div>
    </Link>
  );
}

const STORY_LABEL: Record<string, string> = { MARKET: "Mandi", WEATHER: "Weather", SCHEME: "Scheme", EVENT: "Event", TIP: "Tip", ALERT: "Alert" };

export function StoriesRow({ stories }: { stories: StoryDTO[] }) {
  const [active, setActive] = useState<StoryDTO | null>(null);
  if (!stories.length) return null;
  return (
    <>
      <ul className="scroll-x -mx-4 px-4 py-1 md:mx-0 md:px-0" aria-label="Today's stories">
        {stories.map((s) => (
          <li key={s.id} className="w-[4.75rem]">
            <button onClick={() => setActive(s)} className="flex w-full flex-col items-center gap-1.5" aria-label={`Open story: ${s.title}`}>
              <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-gradient-to-tr from-highlight via-accent to-primary p-[3px]">
                <span className="block h-full w-full overflow-hidden rounded-full border-2 border-background">
                  <Scene kind={s.scene} />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{STORY_LABEL[s.kind] ?? s.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!active} onClose={() => setActive(null)} title={active?.title ?? ""} description={active ? `${active.author.name} · expires ${formatDate(active.expiresAt, { day: "numeric", month: "short" })}` : undefined} footer={active?.link ? <Link href={active.link} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" onClick={() => setActive(null)}>Open</Link> : undefined}>
        {active && (
          <div>
            <div className="mb-3 aspect-[5/3] overflow-hidden rounded-2xl">
              <Scene kind={active.scene} />
            </div>
            <p>{active.body}</p>
            {active.isDemo && <DemoBadge className="mt-3" />}
          </div>
        )}
      </Sheet>
    </>
  );
}
