"use client";
import { Play } from "lucide-react";
import { useCallback } from "react";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Card } from "@/components/ui/card";
import { LoadMore } from "@/components/ui/load-more";
import { ListSkeleton } from "@/components/ui/skeleton";
import { flatten, useInfiniteList } from "@/hooks/use-api";
import type { FeedItem } from "@/types/dto";
import { PostCard, ReelThumb } from "./social";

export function FeedList({ topic, communityId, authorId, emptyAction }: { topic?: string; communityId?: string; authorId?: string; emptyAction?: { label: string; href: string } }) {
  const q = useInfiniteList<FeedItem>("/feed", { topic: topic && topic !== "ForYou" ? topic : undefined, community: communityId, author: authorId, limit: 8 });
  const more = useCallback(() => void q.fetchNextPage(), [q]);
  if (q.isLoading) return <ListSkeleton count={3} media />;
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  const items = flatten(q.data);
  if (!items.length) return <Card><EmptyState title="Nothing here yet" description="Follow farmers and experts, or join a community, to fill your feed." action={emptyAction ?? { label: "Discover farmers", href: "/farmers" }} /></Card>;
  return (
    <div className="space-y-4">
      {items.map((it) =>
        it.type === "post" ? (
          <PostCard key={`p-${it.post.id}`} post={it.post} />
        ) : (
          <Card key={`r-${it.reel.id}`} className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Play className="h-4 w-4 text-accent" aria-hidden /> Suggested reel
            </p>
            <div className="max-w-[12rem]">
              <ReelThumb reel={it.reel} />
            </div>
          </Card>
        ),
      )}
      <LoadMore hasMore={!!q.hasNextPage} loading={q.isFetchingNextPage} onLoad={more} />
    </div>
  );
}
