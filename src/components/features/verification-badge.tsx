"use client";

import { useState } from "react";
import { ShieldCheck, Building2, Store, Award, Phone, MailCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationBadgeDTO, VerificationBadgeType } from "@/types/dto";

interface BadgeConfig {
  icon: typeof ShieldCheck;
  title: string;
  defaultAbout: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  glowClass: string;
}

const BADGE_CONFIGS: Record<VerificationBadgeType, BadgeConfig> = {
  GOVERNMENT: {
    icon: ShieldCheck,
    title: "Official Government Entity",
    defaultAbout: "Verified government institution, department, or administrative authority authenticated through official domain and administrative credentials.",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-500/30 dark:border-amber-500/40",
    glowClass: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
  },
  ORGANIZATION: {
    icon: Building2,
    title: "Official Organization",
    defaultAbout: "Verified FPO, cooperative, registered NGO, or agricultural institute authenticated via institutional registry and domain validation.",
    bgClass: "bg-teal-500/10 dark:bg-teal-500/20",
    textClass: "text-teal-700 dark:text-teal-400",
    borderClass: "border-teal-500/30 dark:border-teal-500/40",
    glowClass: "shadow-[0_0_12px_rgba(13,148,136,0.25)]",
  },
  BUSINESS: {
    icon: Store,
    title: "Verified Business",
    defaultAbout: "Verified enterprise or service provider with verified business registration, location verification, and organizational email validation.",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
    textClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-500/30 dark:border-emerald-500/40",
    glowClass: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
  },
  PROFESSIONAL: {
    icon: Award,
    title: "Verified Professional",
    defaultAbout: "Verified skilled tradesperson or agronomist verified through credentials, skill assessment, or client interaction history.",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-500/30 dark:border-blue-500/40",
    glowClass: "shadow-[0_0_12px_rgba(59,130,246,0.25)]",
  },
  PHONE: {
    icon: Phone,
    title: "Phone Verified",
    defaultAbout: "Directly authenticated via cryptographic SMS one-time password.",
    bgClass: "bg-slate-500/10 dark:bg-slate-500/20",
    textClass: "text-slate-600 dark:text-slate-400",
    borderClass: "border-slate-500/30",
    glowClass: "",
  },
  EMAIL: {
    icon: MailCheck,
    title: "Email Verified",
    defaultAbout: "Ownership verified via secure verification link or code.",
    bgClass: "bg-slate-500/10 dark:bg-slate-500/20",
    textClass: "text-slate-600 dark:text-slate-400",
    borderClass: "border-slate-500/30",
    glowClass: "",
  },
};

export function VerificationBadge({
  badge,
  type = "PROFESSIONAL",
  size = "sm",
  showLabel = false,
  className,
}: {
  badge?: VerificationBadgeDTO | null;
  type?: VerificationBadgeType;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const badgeType = badge?.type ?? type;
  const config = BADGE_CONFIGS[badgeType] ?? BADGE_CONFIGS.PROFESSIONAL;
  const Icon = config.icon;
  const displayLabel = badge?.label ?? config.title;
  const aboutText = badge?.aboutText || config.defaultAbout;

  const sizeClasses = {
    xs: "h-3.5 w-3.5 text-[10px]",
    sm: "h-4 w-4 text-xs",
    md: "h-5 w-5 text-sm",
    lg: "h-6 w-6 text-base",
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title={`${displayLabel} — Click for verification details`}
        aria-label={`${displayLabel} verification details`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40",
          config.textClass,
          showLabel && cn("px-2 py-0.5 border text-xs font-semibold", config.bgClass, config.borderClass, config.glowClass),
          className
        )}
      >
        <Icon className={sizeClasses} aria-hidden />
        {showLabel && <span>{displayLabel}</span>}
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", config.bgClass, config.borderClass, config.textClass)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base leading-snug">{displayLabel}</h3>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">KaamSetu Authenticity Seal</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-muted/60 p-3.5 text-xs text-foreground/90 leading-relaxed border border-border/50">
              <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>About this verification</span>
              </div>
              {aboutText}
            </div>

            {badge?.verifiedAt && (
              <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t border-border">
                <span>Verified on:</span>
                <span className="font-medium text-foreground">{new Date(badge.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-105 active:scale-[0.98] transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

