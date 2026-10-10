"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Mode } from "@/components/providers/theme";

const NEXT: Record<Mode, Mode> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Mode, string> = { light: "Light", dark: "Dark", system: "System" };

/** Header quick-toggle: cycles Light → Dark → System. Full theme gallery lives in Settings. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button onClick={() => setMode(NEXT[mode])} aria-label={`Colour mode: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`} title={`Mode: ${LABEL[mode]}`} className={`tap grid place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}>
      <Icon className="h-5 w-5" />
    </button>
  );
}
