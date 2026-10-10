"use client";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Flag, MessageCircle, Send, Share2, UserCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { useMe } from "@/hooks/use-me";
import { api, ApiClientError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { REPORT_REASONS } from "@/types/domain";

/** Patch the cached "me" counters / follow state is handled by invalidation of affected lists. */
function useRefresh() {
  const qc = useQueryClient();
  return (...prefixes: string[]) =>
    qc.invalidateQueries({
      predicate: (q) => typeof q.queryKey[1] === "string" && prefixes.some((p) => (q.queryKey[1] as string).startsWith(p)),
    });
}

export function useSyncedState<T>(value: T) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return [v, setV] as const;
}

// ───────── Follow ─────────
export function FollowButton({ userId, following, size = "sm", onChange, className }: { userId: string; following: boolean; size?: "sm" | "md"; onChange?: (v: boolean) => void; className?: string }) {
  const toast = useToast();
  const refresh = useRefresh();
  const { data: me } = useMe();
  const [on, setOn] = useSyncedState(following);
  const [busy, setBusy] = useState(false);
  if (me?.id === userId) return null;
  const toggle = async () => {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await api(next ? "POST" : "DELETE", `/follow/${userId}`);
      onChange?.(next);
      void refresh("/farmers", "/buyers", "/experts", "/orgs", "/users", "/feed");
    } catch (e) {
      setOn(!next);
      toast({ kind: "error", title: "Couldn't update follow", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size={size} variant={on ? "outline" : "primary"} onClick={toggle} disabled={busy} aria-pressed={on} className={className}>
      {on ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {on ? "Following" : "Follow"}
    </Button>
  );
}

// ───────── Like / Save ─────────
export function LikeButton({ targetType, targetId, liked, count, className, variant = "inline" }: { targetType: "POST" | "REEL" | "QUESTION"; targetId: string; liked: boolean; count: number; className?: string; variant?: "inline" | "stack" }) {
  const toast = useToast();
  const [on, setOn] = useSyncedState(liked);
  const [n, setN] = useSyncedState(count);
  const [pop, setPop] = useState(false);
  const toggle = async () => {
    const next = !on;
    setOn(next);
    setN((x) => x + (next ? 1 : -1));
    setPop(true);
    try {
      const r = await api<{ liked: boolean; count: number }>("POST", "/like", { targetType, targetId });
      setOn(r.liked);
      setN(r.count);
    } catch (e) {
      setOn(!next);
      setN((x) => x + (next ? -1 : 1));
      toast({ kind: "error", title: "Couldn't like this", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <button onClick={toggle} aria-pressed={on} aria-label={on ? `Unlike (${n} likes)` : `Like (${n} likes)`} className={cn("tap inline-flex items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition-colors", variant === "stack" ? "flex-col gap-0.5 text-white" : on ? "text-danger" : "text-muted-foreground hover:text-foreground", className)}>
      <svg viewBox="0 0 24 24" className={cn("h-6 w-6", pop && "pop")} onAnimationEnd={() => setPop(false)} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={variant === "stack" && on ? { color: "hsl(0 84% 62%)" } : undefined} aria-hidden>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
      <span className="tabular-nums">{n}</span>
    </button>
  );
}

export function SaveButton({ targetType, targetId, saved, className, label, variant = "inline" }: { targetType: "POST" | "REEL" | "LISTING" | "SCHEME" | "EVENT" | "FARMER" | "PROFESSIONAL" | "WORK" | "SERVICE"; targetId: string; saved: boolean; className?: string; label?: boolean; variant?: "inline" | "stack" }) {
  const toast = useToast();
  const refresh = useRefresh();
  const [on, setOn] = useSyncedState(saved);
  const toggle = async () => {
    const next = !on;
    setOn(next);
    try {
      const r = await api<{ saved: boolean }>("POST", "/save", { targetType, targetId });
      setOn(r.saved);
      toast({ title: r.saved ? "Saved" : "Removed from saved" });
      void refresh("/saved");
    } catch (e) {
      setOn(!next);
      toast({ kind: "error", title: "Couldn't save", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <button onClick={toggle} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save"} className={cn("tap inline-flex items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition-colors", variant === "stack" ? "flex-col text-white" : on ? "text-accent" : "text-muted-foreground hover:text-foreground", className)}>
      <Bookmark className="h-6 w-6" fill={on ? "currentColor" : "none"} aria-hidden />
      {label && <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}

export function ShareButton({ title, path, className, variant = "inline", label }: { title: string; path: string; className?: string; variant?: "inline" | "stack"; label?: string }) {
  const toast = useToast();
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      }
    } catch {
      /* user cancelled */
    }
  };
  return (
    <button onClick={share} aria-label={label ?? "Share"} className={cn("tap inline-flex items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground", variant === "stack" && "flex-col text-white hover:text-white", className)}>
      <Share2 className="h-6 w-6" aria-hidden />
      {label && <span>{label}</span>}
    </button>
  );
}

// ───────── Report ─────────
const reportForm = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().max(400).optional() });
type ReportValues = z.infer<typeof reportForm>;

export function ReportButton({ targetType, targetId, label = "Report", className }: { targetType: "POST" | "REEL" | "COMMENT" | "USER" | "LISTING" | "QUESTION" | "MESSAGE" | "REQUIREMENT" | "SERVICE" | "OPPORTUNITY" | "BUSINESS"; targetId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { register, handleSubmit, formState, reset } = useForm<ReportValues>({ resolver: zodResolver(reportForm), defaultValues: { reason: "Spam", details: "" } });
  const submit = handleSubmit(async (v) => {
    try {
      await api("POST", "/reports", { targetType, targetId, ...v });
      toast({ title: "Report sent", description: "Thank you. Our moderators will review it." });
      setOpen(false);
      reset();
    } catch (e) {
      toast({ kind: "error", title: "Couldn't send report", description: e instanceof ApiClientError ? e.message : undefined });
    }
  });
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={label} className={cn("tap inline-flex items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-muted-foreground hover:text-danger", className)}>
        <Flag className="h-4 w-4" aria-hidden /> {label !== "Report" ? label : <span className="sr-only">Report</span>}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Report this"
        description="Tell us what's wrong. Reports are anonymous to the other person."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={formState.isSubmitting}>
              Send report
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Reason" required>
            {(a) => (
              <Select {...a} {...register("reason")}>
                {REPORT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Details (optional)" error={formState.errors.details?.message}>
            {(a) => <Textarea {...a} {...register("details")} rows={3} maxLength={400} />}
          </Field>
        </form>
      </Sheet>
    </>
  );
}

// ───────── Message ─────────
const msgForm = z.object({ message: z.string().trim().min(1, "Write a message").max(2000) });

export function MessageButton({ userId, name, context, variant = "outline", size = "sm", label = "Message", defaultText = "", className, icon = true }: { userId: string; name: string; context?: { kind: "LISTING" | "REQUIREMENT" | "QUESTION" | "DIRECT"; id?: string; title: string }; variant?: "outline" | "primary" | "secondary" | "accent"; size?: "sm" | "md" | "lg"; label?: string; defaultText?: string; className?: string; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useMe();
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof msgForm>>({ resolver: zodResolver(msgForm), defaultValues: { message: defaultText } });
  if (me?.id === userId) return null;
  const submit = handleSubmit(async (v) => {
    try {
      const r = await api<{ conversationId: string }>("POST", "/conversations", { userId, message: v.message, context });
      setOpen(false);
      toast({ title: "Message sent" });
      router.push(`/messages?c=${r.conversationId}`);
    } catch (e) {
      setError("message", { message: e instanceof ApiClientError ? e.message : "Couldn't send the message" });
    }
  });
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className={className}>
        {icon && <MessageCircle className="h-4 w-4" />} {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Message ${name}`}
        description={context?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={formState.isSubmitting}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-3">
          <Notice tone="warning" title="Stay safe">
            Never share OTPs, PINs, Aadhaar or card numbers. Don&apos;t pay any advance to someone you haven&apos;t met. KaamSetu doesn&apos;t handle payments.
          </Notice>
          <Field label="Your message" error={formState.errors.message?.message} required>
            {(a) => <Textarea {...a} {...register("message")} rows={4} maxLength={2000} data-autofocus placeholder="Hello! I'm interested in…" />}
          </Field>
        </form>
      </Sheet>
    </>
  );
}

export function IconStat({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground", className)}>
      {icon}
      {children}
    </span>
  );
}
