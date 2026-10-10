"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiClientError } from "@/lib/api";
import type { Me } from "@/types/dto";

/** Current user, or null when signed out. Never throws for 401. */
export function useMe() {
  return useQuery<Me | null, ApiClientError>({
    queryKey: ["api", "/auth/me"],
    queryFn: async () => {
      try {
        return await apiGet<Me>("/auth/me");
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}
