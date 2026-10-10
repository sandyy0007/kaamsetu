"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { VoiceButton } from "./voice-button";

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchField({ value, onChange, placeholder, label, voice = true, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; voice?: boolean; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className={cn("pl-10", voice ? "pr-24" : "pr-10")} />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
        {value && (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="tap grid h-9 w-9 min-h-0 min-w-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
        {voice && <VoiceButton label="Search by voice" className="h-9 w-9 min-h-0 min-w-0" onText={(t) => onChange(t)} />}
      </div>
    </div>
  );
}

/** Collapsible filter panel: always visible on desktop, a toggle on mobile. */
export function FilterPanel({ children, activeCount = 0, onClear }: { children: ReactNode; activeCount?: number; onClear?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 md:hidden">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="tap inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        {activeCount > 0 && onClear && (
          <button onClick={onClear} className="text-sm font-semibold text-primary">
            Clear
          </button>
        )}
      </div>
      <div className={cn("mt-3 grid gap-3 sm:grid-cols-2 md:mt-0 md:grid-cols-4", open ? "grid" : "hidden md:grid")}>{children}</div>
      {activeCount > 0 && onClear && (
        <button onClick={onClear} className="mt-2 hidden text-sm font-semibold text-primary md:block">
          Clear all filters
        </button>
      )}
    </div>
  );
}

export function ToggleChip({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={cn("tap inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors", on ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}>
      {children}
    </button>
  );
}
