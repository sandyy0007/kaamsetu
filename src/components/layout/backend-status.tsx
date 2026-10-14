"use client";

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

type ConnectionState = "connected" | "connecting" | "offline";

export function BackendStatusBanner() {
  const [state, setState] = useState<ConnectionState>("connected");
  const [retrying, setRetrying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const queryClient = useQueryClient();

  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(apiUrl("/healthz"), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);
      return res.status >= 200 && res.status < 500;
    } catch {
      return false;
    }
  }, []);

  const checkConnection = useCallback(async () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      setState("offline");
      return;
    }

    const alive = await pingServer();
    if (alive) {
      if (state !== "connected") {
        setState("connected");
        // Invalidate queries so client data refreshes when connection is established
        void queryClient.invalidateQueries();
      }
      setElapsed(0);
    } else {
      setState((prev) => {
        if (prev === "connected") return "connecting";
        return prev;
      });
    }
  }, [pingServer, queryClient, state]);

  // Initial check on mount, especially on native Capacitor
  useEffect(() => {
    void checkConnection();

    // Set up background polling when connecting or offline
    const interval = setInterval(() => {
      if (state !== "connected") {
        setElapsed((e) => e + 4);
        void checkConnection();
      }
    }, 4000);

    const handleOnline = () => void checkConnection();
    const handleOffline = () => setState("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkConnection, state]);

  const handleManualRetry = async () => {
    setRetrying(true);
    const alive = await pingServer();
    if (alive) {
      setState("connected");
      setElapsed(0);
      void queryClient.invalidateQueries();
    } else {
      setState(navigator.onLine ? "connecting" : "offline");
    }
    setRetrying(false);
  };

  // If connected, render nothing (no intrusive UI)
  if (state === "connected") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex w-full items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-sm dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-900/60"
    >
      <div className="flex items-center gap-2">
        {state === "connecting" ? (
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <span>
          {state === "connecting"
            ? elapsed > 35
              ? "Backend is taking longer than usual to wake up (Render cold start). Still connecting..."
              : "Connecting to KaamSetu service in background (cloud server is starting)..."
            : "Device is offline or server is currently unreachable. You can continue browsing cached content."}
        </span>
      </div>

      <button
        type="button"
        onClick={handleManualRetry}
        disabled={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
      >
        <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        Retry
      </button>
    </div>
  );
}

