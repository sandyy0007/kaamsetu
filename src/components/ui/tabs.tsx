"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

/** Accessible tab list (roving tabindex, arrow-key navigation). Panels are rendered by the caller. */
export function Tabs<T extends string>({ items, value, onChange, label, className, scroll = true }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string; scroll?: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.id === value);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    else return;
    e.preventDefault();
    const next = items[n]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex gap-1 border-b", scroll && "scroll-x", className)}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn("tap -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-primary/12" : "bg-muted")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-style single-choice control. */
export function Segmented<T extends string>({ items, value, onChange, label, className }: { items: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-muted p-1", className)}>
      {items.map((t) => (
        <button key={t.id} role="radio" aria-checked={t.id === value} onClick={() => onChange(t.id)} className={cn("min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors", t.id === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Horizontally scrolling filter chips. */
export function ChipRow<T extends string>({ items, value, onChange, label, all }: { items: readonly T[]; value: T | ""; onChange: (v: T | "") => void; label: string; all?: string }) {
  const chip = (id: string, text: string) => (
    <button key={id} aria-pressed={value === id} onClick={() => onChange(id as T | "")} className={cn("tap rounded-full border px-3.5 text-sm font-semibold transition-colors", value === id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted")} style={{ minWidth: 0 }}>
      {text}
    </button>
  );
  return (
    <div role="group" aria-label={label} className="scroll-x -mx-4 px-4 py-1 md:mx-0 md:px-0">
      {all !== undefined && chip("", all)}
      {items.map((i) => chip(i, i))}
    </div>
  );
}
