"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  description?: string;
}
interface ToastCtx {
  toast: (t: { title: string; description?: string; kind?: Kind }) => void;
}
const Ctx = createContext<ToastCtx | null>(null);

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const TONE = { success: "text-success", error: "text-danger", info: "text-info" } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    ({ title, description, kind = "success" }: { title: string; description?: string; kind?: Kind }) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-xl border bg-card p-3 text-sm shadow-pop">
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", TONE[t.kind])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-muted-foreground">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="tap -m-2 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c.toast;
}
