import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5", {
  variants: {
    tone: {
      neutral: "bg-muted text-foreground/80",
      primary: "bg-primary/12 text-primary",
      accent: "bg-accent/14 text-accent",
      success: "bg-success/14 text-success",
      warning: "bg-warning/16 text-warning",
      danger: "bg-danger/14 text-danger",
      info: "bg-info/14 text-info",
      outline: "border text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

/** Visible, honest marker for seeded sample content. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span title="Sample content for demonstration — not a real record" className={cn("inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-1.5 text-[10px] font-bold uppercase leading-4 tracking-wide text-warning", className)}>
      Demo
    </span>
  );
}
