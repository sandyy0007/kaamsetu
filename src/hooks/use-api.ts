"use client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, apiGet, ApiClientError } from "@/lib/api";
import type { Page } from "@/types/dto";

/** GET query keyed by the request path, so invalidation can target path prefixes. */
export function useGet<T>(path: string | null, opts: { enabled?: boolean; staleTime?: number; refetchInterval?: number; keepPrevious?: boolean } = {}) {
  return useQuery<T, ApiClientError>({
    queryKey: ["api", path] as QueryKey,
    queryFn: ({ signal }) => apiGet<T>(path as string, signal),
    enabled: path !== null && (opts.enabled ?? true),
    staleTime: opts.staleTime ?? 20_000,
    refetchInterval: opts.refetchInterval,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    retry: (n, err) => !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) && n < 2,
  });
}

/** Cursor-paginated list (server returns {items,nextCursor,total}). */
export function useInfiniteList<T>(basePath: string | null, params: Record<string, string | number | undefined | null | boolean> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v));
  const qs = sp.toString();
  return useInfiniteQuery<Page<T>, ApiClientError>({
    queryKey: ["api", basePath, "list", qs] as QueryKey,
    enabled: basePath !== null,
    initialPageParam: "" as string,
    queryFn: ({ pageParam, signal }) => {
      const q = new URLSearchParams(qs);
      if (pageParam) q.set("cursor", pageParam as string);
      const s = q.toString();
      return apiGet<Page<T>>(`${basePath}${s ? `?${s}` : ""}`, signal);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 20_000,
    retry: (n, err) => !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) && n < 2,
  });
}

export function flatten<T>(data: { pages: Page<T>[] } | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

/** Invalidate every cached query whose path starts with one of the prefixes. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...prefixes: string[]) =>
    qc.invalidateQueries({
      predicate: (q) => {
        const p = q.queryKey[1];
        return typeof p === "string" && prefixes.some((x) => p.startsWith(x));
      },
    });
}

interface MutateOpts<TOut> {
  invalidate?: string[];
  onSuccess?: (data: TOut) => void;
  onError?: (err: ApiClientError) => void;
}

/** Mutation helper: `const m = useSend<In,Out>("POST", (v)=>"/path", {invalidate:["/feed"]})`. */
export function useSend<TIn = void, TOut = unknown>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string | ((v: TIn) => string), opts: MutateOpts<TOut> = {}) {
  const invalidate = useInvalidate();
  return useMutation<TOut, ApiClientError, TIn>({
    mutationFn: (v) => api<TOut>(method, typeof path === "function" ? path(v) : path, v === undefined || method === "DELETE" ? undefined : v),
    onSuccess: (data) => {
      if (opts.invalidate?.length) void invalidate(...opts.invalidate);
      opts.onSuccess?.(data);
    },
    onError: (e) => opts.onError?.(e),
  });
}
