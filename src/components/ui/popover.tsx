"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimal anchored popover: closes on outside click / Esc, focus returns to the trigger. */
export function Popover({ trigger, children, align = "right", label, className }: { trigger: (p: { open: boolean; toggle: () => void; props: { "aria-haspopup": "dialog"; "aria-expanded": boolean } }) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), props: { "aria-haspopup": "dialog", "aria-expanded": open } })}
      {open && (
        <div role="dialog" aria-label={label} className={cn("absolute top-full z-50 mt-2 w-72 animate-scale-in rounded-2xl border bg-card p-2 shadow-pop", align === "right" ? "right-0" : "left-0", className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
