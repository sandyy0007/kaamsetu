"use client";
import { useEffect, useRef } from "react";
import { Button } from "./button";

/** Auto-loads the next page when scrolled into view, with a manual button as an accessible fallback. */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && !loading && onLoad(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoad]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex justify-center py-4">
      <Button variant="outline" onClick={onLoad} loading={loading}>
        Load more
      </Button>
    </div>
  );
}
