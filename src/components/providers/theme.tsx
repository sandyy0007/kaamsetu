"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Palette = "farm" | "earth" | "sunrise";
export type Mode = "light" | "dark" | "system";
export type Preset = "farm-light" | "farm-dark" | "earth" | "sunrise";

export const THEME_KEY = "ks-theme";
export const MODE_KEY = "ks-mode";

interface ThemeCtx {
  palette: Palette;
  mode: Mode;
  resolved: "light" | "dark";
  preset: Preset;
  setPalette: (p: Palette) => void;
  setMode: (m: Mode) => void;
  setPreset: (p: Preset) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable (private mode) — theme still applies for this session */
  }
};

const systemDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(palette: Palette, resolved: "light" | "dark") {
  const el = document.documentElement;
  el.dataset.theme = palette;
  el.dataset.mode = resolved;
  el.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0b140f" : "#f6f2ea");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>("farm");
  const [mode, setModeState] = useState<Mode>("light");
  const [sysDark, setSysDark] = useState(false);

  // Hydrate from storage (the inline init script already painted the right theme; this syncs React state).
  useEffect(() => {
    const p = safeGet(THEME_KEY);
    const m = safeGet(MODE_KEY);
    if (p === "farm" || p === "earth" || p === "sunrise") setPaletteState(p);
    if (m === "light" || m === "dark" || m === "system") setModeState(m);
    setSysDark(systemDark());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? (sysDark ? "dark" : "light") : mode;

  useEffect(() => {
    apply(palette, resolved);
  }, [palette, resolved]);

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
    safeSet(THEME_KEY, p);
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    safeSet(MODE_KEY, m);
  }, []);
  const setPreset = useCallback(
    (p: Preset) => {
      if (p === "farm-light") {
        setPalette("farm");
        setMode("light");
      } else if (p === "farm-dark") {
        setPalette("farm");
        setMode("dark");
      } else setPalette(p);
    },
    [setMode, setPalette],
  );

  const preset: Preset = palette === "farm" ? (resolved === "dark" ? "farm-dark" : "farm-light") : palette;

  const value = useMemo(() => ({ palette, mode, resolved, preset, setPalette, setMode, setPreset }), [palette, mode, resolved, preset, setPalette, setMode, setPreset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used inside ThemeProvider");
  return c;
}

/** Inline script (runs before first paint) so there is never a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("${THEME_KEY}");var m=localStorage.getItem("${MODE_KEY}");if(p!=="farm"&&p!=="earth"&&p!=="sunrise")p="farm";if(m!=="light"&&m!=="dark"&&m!=="system")m="light";var r=m==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;d.dataset.theme=p;d.dataset.mode=r;d.style.colorScheme=r;}catch(e){}})();`;
