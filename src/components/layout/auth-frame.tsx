import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { Scene } from "@/components/art/scene";
import { TAGLINE } from "@/lib/constants";
import { Logo } from "./logo";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Scene kind="mustard" className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--overlay)/0.85)] via-[hsl(var(--overlay)/0.2)] to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Logo className="[&_span]:text-white" />
          <div>
            <h2 className="text-4xl leading-tight">{TAGLINE}</h2>
            <p className="mt-3 max-w-md text-lg text-white/85">Farm records, a professional profile, buyers, experts, schemes and learning — one trusted place built for Indian farmers.</p>
          </div>
        </div>
      </aside>
      <main className="flex min-h-dvh flex-col">
        <div className="page-pad flex h-16 items-center justify-between">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="page-pad mx-auto w-full max-w-lg flex-1 pb-12 pt-2">{children}</div>
      </main>
    </div>
  );
}
