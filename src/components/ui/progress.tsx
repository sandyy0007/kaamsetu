import { cn } from "@/lib/utils";

export function Progress({ value, max = 100, label, className, tone = "primary" }: { value: number; max?: number; label?: string; className?: string; tone?: "primary" | "accent" | "success" | "warning" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg = { primary: "bg-primary", accent: "bg-accent", success: "bg-success", warning: "bg-warning" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}
