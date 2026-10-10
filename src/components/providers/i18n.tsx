"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate } from "@/lib/i18n";
import type { Language } from "@/types/domain";

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}
const Ctx = createContext<I18nCtx | null>(null);
const KEY = "ks-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "en" || v === "hi" || v === "hinglish") setLangState(v);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);
  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const t = useCallback((k: string) => translate(lang, k), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
