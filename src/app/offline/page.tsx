import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <WifiOff className="h-8 w-8" aria-hidden />
        </div>
        <h1>You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">KaamSetu needs an internet connection to load your profile and work data. Reconnect and refresh — nothing you saved has been lost.</p>
      </div>
    </main>
  );
}
