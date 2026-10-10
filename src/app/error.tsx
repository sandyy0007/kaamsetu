"use client";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the console for debugging; a production build would forward this to an error tracker.
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div role="alert">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-danger/12 text-danger">
          <AlertTriangle className="h-8 w-8" aria-hidden />
        </div>
        <h1>Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">We couldn&apos;t load this page. Your data is safe. Please try again.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/home" variant="outline">
            Go to Home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
