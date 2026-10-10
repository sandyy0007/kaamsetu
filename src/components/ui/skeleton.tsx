import { cn } from "@/lib/utils";
import { Card } from "./card";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

export function CardSkeleton({ lines = 3, media = false }: { lines?: number; media?: boolean }) {
  return (
    <Card className="space-y-3 p-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {media && <Skeleton className="h-40 w-full" />}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-3.5 w-2/3" : "h-3.5"} />
      ))}
    </Card>
  );
}

export function ListSkeleton({ count = 4, media = false }: { count?: number; media?: boolean }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} media={media} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
