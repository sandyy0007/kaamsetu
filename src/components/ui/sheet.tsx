"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: bottom sheet on mobile, centred card on desktop.
 * Traps focus, closes on Esc / backdrop, restores focus, and locks body scroll.
 */
export function Sheet({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && node) {
        const els = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!els.length) return;
        const a = els[0]!;
        const z = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = overflow;
      prev.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const w = { sm: "md:max-w-sm", md: "md:max-w-lg", lg: "md:max-w-2xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-[hsl(var(--overlay)/0.55)]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cn("relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-3xl border bg-card shadow-pop md:animate-scale-in md:rounded-3xl", w)}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="tap -mr-2 -mt-1 grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
