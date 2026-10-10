import Link from "next/link";
import { cn } from "@/lib/utils";

/** Original mark: a sprout rising from a bridge arch ("setu" = bridge). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} role="img" aria-label="KaamSetu logo">
      <rect width="40" height="40" rx="11" style={{ fill: "hsl(var(--primary))" }} />
      <path d="M6 31 Q20 15 34 31" fill="none" strokeWidth="2.6" strokeLinecap="round" style={{ stroke: "hsl(var(--primary-foreground) / 0.9)" }} />
      <path d="M6 31 H34" strokeWidth="2.6" strokeLinecap="round" style={{ stroke: "hsl(var(--primary-foreground) / 0.9)" }} />
      <path d="M20 26 V14" strokeWidth="2.4" strokeLinecap="round" style={{ stroke: "hsl(var(--highlight))", fill: "none" }} />
      <path d="M20 17 C14 17 12 12 13 9 C17 9 20 12 20 17Z" style={{ fill: "hsl(var(--highlight))" }} />
      <path d="M20 15 C26 15 28 10 27 7 C23 7 20 10 20 15Z" style={{ fill: "hsl(var(--primary-foreground))" }} />
    </svg>
  );
}

export function Logo({ href = "/", compact, className }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-xl", className)} aria-label="KaamSetu home">
      <LogoMark />
      {!compact && <span className="text-xl font-extrabold tracking-tight">KaamSetu</span>}
    </Link>
  );
}
