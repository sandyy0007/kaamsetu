"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { isCapacitorApp } from "@/lib/api";
import { useI18n } from "@/components/providers/i18n";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { Landing } from "@/components/features/landing";
import { LANGUAGE_LABEL } from "@/lib/i18n";
import type { Language } from "@/types/domain";
import { cn } from "@/lib/utils";

function NativeAppSplash() {
  const [slowNotice, setSlowNotice] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlowNotice(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="grid min-h-dvh place-items-center p-6 bg-background pt-safe pb-safe"
      role="status"
      aria-label="Loading KaamSetu"
    >
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex justify-center">
          <Logo compact className="scale-125" />
        </div>
        <div className="space-y-2 pt-4">
          <div className="skeleton mx-auto h-4 w-32 rounded-full" />
          <div className="skeleton mx-auto h-3 w-48 rounded-full" />
        </div>
        {slowNotice && (
          <div className="pt-4 space-y-2 animate-fade-in text-xs text-muted-foreground">
            <p>Connecting to KaamSetu cloud services...</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-primary font-semibold underline"
            >
              Tap here to retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Native Android entry view for unauthenticated users.
 * Replaces the web landing page on Android with an authentic mobile entry screen.
 */
function NativeAppEntry() {
  const { lang, setLang } = useI18n();

  return (
    <div className="min-h-dvh flex flex-col justify-between p-6 pt-safe pb-safe bg-background text-foreground">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="my-auto py-8 max-w-sm mx-auto w-full text-center space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>काम से पहचान, हुनर से अवसर</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">KaamSetu</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The dedicated network for skilled, independent and local professionals. Build your identity, showcase your trade, and discover genuine opportunities.
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <ButtonLink
            href="/login"
            size="lg"
            className="w-full justify-center text-base font-bold shadow-md min-h-12"
          >
            Sign In <ArrowRight className="h-4 w-4 ml-1" />
          </ButtonLink>

          <ButtonLink
            href="/register"
            variant="outline"
            size="lg"
            className="w-full justify-center text-base font-semibold bg-card min-h-12"
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> Create Free Profile
          </ButtonLink>
        </div>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Select Language / भाषा चुनें</p>
          <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Language">
            {(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  "min-h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                  lang === l
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                )}
              >
                {LANGUAGE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Production Cloud Backend · Secure & Private</span>
        </div>
        <p>© KaamSetu. Built for India’s workforce.</p>
      </footer>
    </div>
  );
}

/**
 * Platform-aware root component.
 * On Web: Displays the marketing landing page.
 * On Native Android (Capacitor):
 * - If already authenticated: automatically routes directly to /home.
 * - If deep-linking/fallback URL: automatically forwards to the target pathname.
 * - If unauthenticated: displays the native mobile entry screen.
 */
export function AppEntry() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const [isNative, setIsNative] = useState<boolean | null>(null);

  useEffect(() => {
    const native = isCapacitorApp();
    setIsNative(native);

    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;

      console.log("[KaamSetu:AppEntry]", {
        pathname,
        search,
        isNative: native,
        isLoading,
        hasMe: !!me,
      });

      if (native && !isLoading) {
        // ONLY redirect to /home if user loaded the root path ("/" or "/index.html" or empty)
        if (pathname === "/" || pathname === "" || pathname === "/index.html") {
          if (me) {
            console.log("[KaamSetu:AppEntry] Authenticated at root -> routing to /home");
            router.replace("/home");
          }
        } else {
          // A non-root route was loaded via SPA fallback!
          console.log("[KaamSetu:AppEntry] Forwarding fallback route to:", pathname);
          // If pathname is /professionals/:id, normalize to /professionals?id=:id
          const proMatch = pathname.match(/^\/professionals\/([^/?#]+)/);
          const farmerMatch = pathname.match(/^\/farmers\/([^/?#]+)/);
          const buyerMatch = pathname.match(/^\/buyers\/([^/?#]+)/);
          const expertMatch = pathname.match(/^\/experts\/([^/?#]+)/);
          const orgMatch = pathname.match(/^\/orgs\/([^/?#]+)/);

          if (proMatch && proMatch[1] !== "_default" && proMatch[1] !== "index") {
            router.replace(`/professionals?id=${encodeURIComponent(proMatch[1])}${search ? `&${search.slice(1)}` : ""}${hash}`);
          } else if (farmerMatch && farmerMatch[1] !== "_default" && farmerMatch[1] !== "index") {
            router.replace(`/professionals?id=${encodeURIComponent(farmerMatch[1])}${search ? `&${search.slice(1)}` : ""}${hash}`);
          } else if (buyerMatch && buyerMatch[1] !== "_default" && buyerMatch[1] !== "index") {
            router.replace(`/buyers?id=${encodeURIComponent(buyerMatch[1])}${search ? `&${search.slice(1)}` : ""}${hash}`);
          } else if (expertMatch && expertMatch[1] !== "_default" && expertMatch[1] !== "index") {
            router.replace(`/experts?id=${encodeURIComponent(expertMatch[1])}${search ? `&${search.slice(1)}` : ""}${hash}`);
          } else if (orgMatch && orgMatch[1] !== "_default" && orgMatch[1] !== "index") {
            router.replace(`/orgs?id=${encodeURIComponent(orgMatch[1])}${search ? `&${search.slice(1)}` : ""}${hash}`);
          } else {
            router.replace(pathname + search + hash);
          }
        }
      }
    }
  }, [isLoading, me, router]);

  // While detecting platform or loading initial session state
  if (isNative === null || (isNative && isLoading)) {
    return <NativeAppSplash />;
  }

  // If on native Android
  if (isNative) {
    if (me) {
      return <NativeAppSplash />;
    }
    return <NativeAppEntry />;
  }

  // Web desktop / browser visitors continue seeing the web marketing landing page
  return <Landing />;
}

