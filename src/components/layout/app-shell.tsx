"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Search,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { VoiceSearchModal } from "@/components/features/voice-search-modal";
import { useI18n } from "@/components/providers/i18n";
import { Avatar, VerifiedMark } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { useMe } from "@/hooks/use-me";
import { api } from "@/lib/api";
import { LANGUAGE_LABEL } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import type { Language } from "@/types/domain";
import { Logo } from "./logo";
import { BOTTOM_NAV, NAV_GROUPS, isActive, type NavItem } from "./nav-config";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span
      className="absolute -right-1 -top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[1.1rem] text-white"
      aria-label={`${n} unread`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function SearchBar({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const go = (e?: FormEvent, text = q) => {
    e?.preventDefault();
    const s = text.trim();
    if (s) router.push(`/explore?q=${encodeURIComponent(s)}`);
  };
  return (
    <>
      <form
        onSubmit={go}
        role="search"
        className={cn(
          "flex items-center rounded-xl border bg-card pl-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
          className,
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${t("action.search")} — e.g. Electrician in Jaipur`}
          aria-label={t("action.search")}
          className="min-h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/80"
        />
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          aria-label="Search by voice / बोलकर खोजें"
          title="Voice search"
          className="tap grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Mic className="h-4 w-4" />
        </button>
      </form>
      <VoiceSearchModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        initialLanguage={lang}
      />
    </>
  );
}

function AccountMenu() {
  const { data: me } = useMe();
  const { lang, setLang, t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  if (!me) return null;
  const signOut = async () => {
    try {
      await api("POST", "/auth/logout");
    } finally {
      qc.clear();
      router.replace("/");
    }
  };
  return (
    <Popover
      label="Account menu"
      trigger={({ toggle, props }) => (
        <button
          onClick={toggle}
          {...props}
          aria-label="Account menu"
          className="tap grid place-items-center rounded-full"
        >
          <Avatar name={me.name} hue={me.hue} size="sm" />
        </button>
      )}
    >
      {(close) => (
        <div className="text-sm">
          <div className="flex items-center gap-3 border-b p-3">
            <Avatar name={me.name} hue={me.hue} size="md" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate font-bold">
                {me.name}
                {me.verified && <VerifiedMark label={me.badge} />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABEL[me.role]}
              </p>
            </div>
          </div>
          <div className="py-1">
            <MenuLink
              href="/profile"
              icon={<UserIcon className="h-4 w-4" />}
              onClick={close}
            >
              {t("nav.profile")}
            </MenuLink>
            <MenuLink
              href="/settings"
              icon={<Settings className="h-4 w-4" />}
              onClick={close}
            >
              {t("nav.settings")}
            </MenuLink>
          </div>
          <div className="border-t p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Language
            </p>
            <div
              className="flex gap-1.5"
              role="radiogroup"
              aria-label="Language"
            >
              {(["en", "hi", "hinglish"] as Language[]).map((l) => (
                <button
                  key={l}
                  role="radio"
                  aria-checked={lang === l}
                  onClick={() => {
                    setLang(l);
                    void api("PATCH", "/me", { language: l }).catch(
                      () => undefined,
                    );
                  }}
                  className={cn(
                    "min-h-9 flex-1 rounded-lg border px-2 text-xs font-semibold",
                    lang === l
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {LANGUAGE_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t pt-1">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold text-danger hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: me } = useMe();
  const unread = {
    "/messages": me?.unreadMessages ?? 0,
    "/notifications": me?.unreadNotifications ?? 0,
  } as Record<string, number>;
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV_GROUPS.map((g) => {
        const items = g.items.filter(
          (i) => !i.roles || (me && i.roles.includes(me.role)),
        );
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = isActive(pathname, i);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <i.icon className="h-5 w-5 shrink-0" aria-hidden />
                      {t(i.key)}
                      {unread[i.href] ? (
                        <span className="ml-auto rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                          {unread[i.href]}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-nav/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BOTTOM_NAV.map((i: NavItem) => {
          const active = isActive(pathname, i);
          const center = i.href === "/create";
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.6rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {center ? (
                  <span className="-mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
                    <i.icon className="h-6 w-6" aria-hidden />
                  </span>
                ) : (
                  <i.icon
                    className={cn("h-6 w-6", active && "stroke-[2.4]")}
                    aria-hidden
                  />
                )}
                <span className={center ? "-mt-0.5" : undefined}>
                  {t(i.key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Splash() {
  return (
    <div
      className="grid min-h-dvh place-items-center p-6"
      role="status"
      aria-label="Loading KaamSetu"
    >
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

/**
 * Authenticated application frame: sticky header, desktop sidebar, mobile bottom navigation,
 * floating AI button. Redirects signed-out visitors to /login.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isLoading, isError, error, refetch } = useMe();
  const { t, setLang } = useI18n();
  const [menu, setMenu] = useState(false);
  const meId = me?.id;
  const meLang = me?.language;
  // Sync the interface language from the account preference when a user signs in.
  useEffect(() => {
    if (meId && meLang) setLang(meLang);
  }, [meId, meLang, setLang]);

  useEffect(() => {
    if (!isLoading && !isError && me === null)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, isError, me, pathname, router]);

  useEffect(() => setMenu(false), [pathname]);

  // Synchronize unread counts (messages & notifications) on app resume, window focus, or periodic interval
  useEffect(() => {
    const handleSync = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refetch();
      }
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refetch();
      }
    }, 30000);
    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      clearInterval(interval);
    };
  }, [refetch]);

  if (isError && !me) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 bg-background pt-safe pb-safe">
        <ErrorState
          error={error}
          title="Could not connect to KaamSetu"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isLoading || (!me && !isError)) return <Splash />;
  if (!me) return <Splash />;

  const bleed = pathname === "/reels";
  const hideAi =
    pathname.startsWith("/ai-assistant") ||
    bleed ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/live/") ||
    // Full-width sticky Back/Next/Save bars live here; the floating button would sit on top of them.
    pathname === "/profile/create" ||
    pathname === "/profile/edit";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r bg-nav px-3 py-4 md:flex">
        <Logo className="px-2" />
        <SideNav />
        <div className="mt-auto rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          {me.demoMode
            ? "Demo mode: sample content is marked DEMO. No real payments or transactions happen on KaamSetu."
            : "KaamSetu does not process payments. Always verify buyers and sellers before you trade."}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-nav/90 backdrop-blur pt-safe">
          <div className="page-pad mx-auto flex h-14 max-w-6xl items-center gap-1.5 md:h-16 md:gap-3">
            <button
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              className="tap -ml-1 grid place-items-center rounded-xl text-foreground hover:bg-muted md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Logo compact className="md:hidden" />
            <SearchBar className="ml-1 hidden flex-1 md:flex md:max-w-xl" />
            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              <Link
                href="/explore"
                aria-label="Search"
                className="tap hidden place-items-center rounded-xl text-muted-foreground hover:bg-muted sm:grid md:hidden"
              >
                <Search className="h-5 w-5" />
              </Link>
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <Link
                href="/ai-assistant"
                aria-label={t("nav.ai")}
                className="tap relative hidden place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:grid"
              >
                <Bot className="h-5 w-5" />
              </Link>
              <Link
                href="/messages"
                aria-label={t("nav.messages")}
                className="tap relative grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MessageCircle className="h-5 w-5" />
                <Badge n={me.unreadMessages} />
              </Link>
              <Link
                href="/notifications"
                aria-label={t("nav.notifications")}
                className="tap relative grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                <Badge n={me.unreadNotifications} />
              </Link>
              <AccountMenu />
            </div>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            bleed
              ? "p-0 md:px-6 md:py-4"
              : "page-pad mx-auto max-w-6xl py-4 pb-28 sm:py-5 md:py-7 md:pb-12",
          )}
        >
          {children}
        </main>
      </div>

      {!hideAi && (
        <aside aria-label="AI assistant shortcut">
          <Link
            href="/ai-assistant"
            aria-label="Ask the KaamSetu AI assistant"
            className="fixed bottom-24 right-4 z-30 inline-flex h-11 sm:h-12 items-center gap-2 rounded-full bg-accent px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-accent-foreground shadow-pop transition-transform hover:scale-105 md:bottom-6 md:right-6"
          >
            <Bot className="h-5 w-5" />{" "}
            <span className="hidden sm:inline">Ask AI</span>
          </Link>
        </aside>
      )}

      <BottomNav />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Menu" size="sm">
        <div className="-mx-2">
          <div className="mb-3 px-2 md:hidden">
            <SearchBar />
          </div>
          <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 md:hidden">
            <span className="text-xs font-semibold text-muted-foreground">Theme & Display</span>
            <ThemeToggle />
          </div>
          <SideNav onNavigate={() => setMenu(false)} />
        </div>
      </Sheet>
    </div>
  );
}
