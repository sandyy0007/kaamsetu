import Link from "next/link";
import { cn } from "@/lib/utils";

/** Modern brand mark: Abstract 'K' formed by connected pathways connecting work to opportunity ("Setu" bridge). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-8 w-8 sm:h-9 sm:w-9 shrink-0", className)} role="img" aria-label="KaamSetu logo">
      <defs>
        <linearGradient id="ks-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B192C" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="ks-path" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#FCD34D" />
        </linearGradient>
        <linearGradient id="ks-teal" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#5EEAD4" />
        </linearGradient>
      </defs>
      {/* Premium squircle background */}
      <rect width="48" height="48" rx="13" fill="url(#ks-bg)" />
      {/* Subtle bridge arch */}
      <path d="M8 38 C 16 28, 32 28, 40 38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" />
      {/* Left pillar of 'K' (Work pillar) */}
      <rect x="11" y="11" width="5.5" height="26" rx="2.75" fill="#FFFFFF" />
      {/* Upper ascending pathway of 'K' (Opportunity pathway in warm amber) */}
      <path
        d="M17 24 C 21 24, 27 18, 35 13"
        fill="none"
        stroke="url(#ks-path)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Lower bridge arch of 'K' (Setu pathway connecting into foundation) */}
      <path
        d="M17 24 C 22 24, 28 30, 36 35"
        fill="none"
        stroke="url(#ks-teal)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Opportunity beacon node */}
      <circle cx="35" cy="13" r="2.5" fill="#F59E0B" />
    </svg>
  );
}

export function Logo({
  href = "/",
  compact,
  showTagline,
  className,
}: {
  href?: string;
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 sm:gap-2.5 rounded-xl shrink-0 group", className)} aria-label="KaamSetu home">
      <LogoMark />
      {!compact && (
        <div className="flex flex-col">
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-none">
            Kaam<span className="text-primary">Setu</span>
          </span>
          {showTagline && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-tight mt-0.5 hidden sm:inline">
              काम से पहचान, हुनर से अवसर
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
