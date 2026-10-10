"use client";
import { Play, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scene } from "@/components/art/scene";
import { DemoBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ChipRow } from "@/components/ui/tabs";
import { flatten, useInfiniteList } from "@/hooks/use-api";
import { REEL_CATEGORIES } from "@/types/domain";
import type { ReelDTO } from "@/types/dto";
import { profileHref } from "@/lib/links";
import { UserAvatar } from "@/components/ui/avatar";
import { FollowButton, LikeButton, SaveButton, ShareButton } from "./actions";
import { CommentThread } from "./social";
import { MessageCircle } from "lucide-react";

function ReelSlide({ reel, active, muted, onToggleMute, onComments }: { reel: ReelDTO; active: boolean; muted: boolean; onToggleMute: () => void; onComments: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (active && !paused) void v.play().catch(() => undefined);
    else v.pause();
  }, [active, paused]);
  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);
  return (
    <article data-reel={reel.id} aria-label={`Reel: ${reel.caption}`} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {reel.videoUrl ? (
        <video ref={vid} src={active ? reel.videoUrl : undefined} preload={active ? "auto" : "none"} loop muted={muted} playsInline className="h-full w-full object-cover" onClick={() => setPaused((p) => !p)} />
      ) : (
        <div className="absolute inset-0" style={{ filter: "brightness(var(--scene-fixed, 1))" }}>
          <Scene kind={reel.scene} />
        </div>
      )}
      {reel.videoUrl && paused && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Play className="h-16 w-16 fill-white text-white drop-shadow" aria-hidden />
        </span>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pb-5 text-white">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={profileHref(reel.author)} className="flex min-w-0 items-center gap-2 font-bold">
              <UserAvatar user={reel.author} size="sm" />
              <span className="truncate">{reel.author.name}</span>
            </Link>
            {!reel.isOwn && <FollowButton userId={reel.author.id} following={reel.followingAuthor} />}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-snug">{reel.caption}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold backdrop-blur">{reel.category}</span>
            {reel.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-white/85">#{t}</span>
            ))}
            {reel.isDemo && <DemoBadge />}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 rounded-2xl bg-black/35 p-1.5 text-white backdrop-blur">
          <LikeButton targetType="REEL" targetId={reel.id} liked={reel.liked} count={reel.likeCount} variant="stack" />
          <button onClick={onComments} className="tap flex flex-col items-center gap-0.5 text-xs font-bold" aria-label={`Comments (${reel.commentCount})`}>
            <MessageCircle className="h-7 w-7" aria-hidden />
            {reel.commentCount}
          </button>
          <SaveButton targetType="REEL" targetId={reel.id} saved={reel.saved} variant="stack" />
          <ShareButton title={reel.caption.slice(0, 60)} path={`/reels?r=${reel.id}`} variant="stack" />
          {reel.videoUrl && (
            <button onClick={onToggleMute} className="tap grid place-items-center" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ReelsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const start = sp.get("r");
  const [category, setCategory] = useState<"" | (typeof REEL_CATEGORIES)[number]>("");
  const q = useInfiniteList<ReelDTO>("/reels", { category: category || undefined });
  const reels = useMemo(() => flatten(q.data), [q.data]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<ReelDTO | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const didStart = useRef(false);

  // Only the reel at least 60% in view plays.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiveId((e.target as HTMLElement).dataset.reel ?? null);
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-reel]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reels]);

  // Fetch next page when near the end.
  useEffect(() => {
    const i = reels.findIndex((r) => r.id === activeId);
    if (i >= 0 && i >= reels.length - 2 && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, [activeId, reels, q]);

  // Jump to ?r= once loaded; keep URL in sync with the active reel.
  useEffect(() => {
    if (didStart.current || !start || !reels.length) return;
    didStart.current = true;
    scroller.current?.querySelector(`[data-reel="${start}"]`)?.scrollIntoView();
  }, [start, reels]);
  useEffect(() => {
    if (activeId && didStart.current !== false) router.replace(`/reels?r=${activeId}`, { scroll: false });
  }, [activeId, router]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    const el = scroller.current;
    if (!el) return;
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="sr-only">Reels</h1>
      <div className="mb-3 px-4 pt-2 md:px-0 md:pt-0">
        <ChipRow label="Reel category" items={REEL_CATEGORIES} value={category} onChange={(c) => { setCategory(c); didStart.current = true; }} all="All" />
      </div>
      {q.isLoading ? (
        <div className="px-4 md:px-0"><ListSkeleton count={1} media /></div>
      ) : q.isError ? (
        <div className="px-4 md:px-0"><Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card></div>
      ) : !reels.length ? (
        <Card className="mx-4 p-8 text-center text-sm text-muted-foreground md:mx-0">No reels in this category yet. Try another one.</Card>
      ) : (
        <div
          ref={scroller}
          tabIndex={0}
          onKeyDown={onKey}
          aria-label="Reels. Use arrow keys to move between reels."
          className="h-[calc(100dvh-13rem)] min-h-[26rem] snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black md:rounded-3xl md:border md:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-[calc(100dvh-9rem)]"
        >
          {reels.map((r) => (
            <div key={r.id} className="h-full w-full">
              <ReelSlide reel={r} active={activeId === r.id || (!activeId && r === reels[0])} muted={muted} onToggleMute={() => setMuted((m) => !m)} onComments={() => setCommentsFor(r)} />
            </div>
          ))}
        </div>
      )}
      <Sheet open={!!commentsFor} onClose={() => setCommentsFor(null)} title="Comments" description={commentsFor?.caption}>
        {commentsFor && <CommentThread targetType="REEL" targetId={commentsFor.id} />}
      </Sheet>
    </div>
  );
}
