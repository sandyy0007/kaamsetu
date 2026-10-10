import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, href, linkLabel = "See all", className, children }: { title: string; href?: string; linkLabel?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lg md:text-xl">{title}</h2>
      <div className="flex items-center gap-2">
        {children}
        {href && (
          <Link href={href} className="tap inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
            {linkLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "success" | "danger" | "primary" }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "primary" && "text-primary")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  const t = { info: "border-info/30 bg-info/8 text-info", warning: "border-warning/40 bg-warning/10 text-warning", danger: "border-danger/40 bg-danger/10 text-danger", success: "border-success/30 bg-success/10 text-success" }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("rounded-xl border p-3 text-sm", t)}>
      {title && <p className="font-bold">{title}</p>}
      <div className="text-foreground/85">{children}</div>
    </div>
  );
}
