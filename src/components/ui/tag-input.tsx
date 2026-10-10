"use client";
import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/** Type and press Enter / comma to add chips; Backspace removes the last. Optional suggestions list. */
export function TagInput({ value, onChange, placeholder, max = 20, suggestions, id, label, invalid }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; suggestions?: readonly string[]; id?: string; label?: string; invalid?: boolean }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "").trim();
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= max) return;
    onChange([...value, t]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
  };
  const rest = suggestions?.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2.5 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40", invalid && "border-danger")}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/12 py-0.5 pl-2.5 pr-1 text-sm font-semibold text-primary">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/20">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input id={id} aria-label={label} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={() => add(text)} placeholder={value.length ? "" : placeholder} className="min-h-8 min-w-[8rem] flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80" />
      </div>
      {rest && rest.length > 0 && value.length < max && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Suggestions">
          {rest.map((s) => (
            <button type="button" key={s} onClick={() => add(s)} className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
