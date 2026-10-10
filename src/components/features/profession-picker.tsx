"use client";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useCatalog } from "./pro-shared";

export interface ProfessionChoice {
  professionId?: string;
  customProfession?: string;
}

/**
 * Search-and-select profession picker, driven entirely by the server catalog.
 * "Other" lets someone type their own profession — it is created as PENDING and reviewed by an admin.
 */
export function ProfessionPicker({ value, onChange, label = "Your profession", autoFocus }: { value: ProfessionChoice; onChange: (v: ProfessionChoice) => void; label?: string; autoFocus?: boolean }) {
  const { data, isLoading, isError } = useCatalog();
  const [q, setQ] = useState("");
  const [other, setOther] = useState(!!value.customProfession);
  const needle = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const cats = data?.categories ?? [];
    return cats
      .map((c) => ({
        ...c,
        professions: c.professions.filter((p) => p.status === "ACTIVE" && (!needle || `${p.name} ${p.nameHi} ${c.name}`.toLowerCase().includes(needle))),
      }))
      .filter((c) => c.professions.length > 0);
  }, [data, needle]);

  return (
    <div role="group" aria-label={label}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Search professions" placeholder="Search — electrician, driver, tailor, farmer…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" autoFocus={autoFocus} />
      </div>
      <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1" tabIndex={0} aria-label="Professions">
        {isLoading && <p className="text-sm text-muted-foreground">Loading professions…</p>}
        {isError && <p className="text-sm text-danger">Couldn&apos;t load professions. Please try again.</p>}
        {groups.map((c) => (
          <div key={c.id}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <span aria-hidden>{c.emoji}</span> {c.name}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {c.professions.map((p) => {
                const on = !other && value.professionId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setOther(false);
                        onChange({ professionId: p.id });
                      }}
                      className={cn("tap inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors", on ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}
                    >
                      <span aria-hidden>{p.emoji}</span> {p.name}
                      {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {!isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">No match. Use “Other” below to add your own.</p>}
      </div>
      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          aria-pressed={other}
          onClick={() => {
            setOther(true);
            onChange({ customProfession: value.customProfession ?? "" });
          }}
          className={cn("tap inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors", other ? "border-primary bg-primary/12 text-primary" : "bg-card hover:bg-muted")}
        >
          ➕ Other — my profession isn&apos;t listed
        </button>
        {other && (
          <div className="mt-2">
            <Input aria-label="Your profession" placeholder="e.g. Beekeeper" maxLength={60} value={value.customProfession ?? ""} onChange={(e) => onChange({ customProfession: e.target.value })} />
            <p className="mt-1 text-xs text-muted-foreground">You can start right away. A KaamSetu admin reviews new professions before they appear for everyone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
