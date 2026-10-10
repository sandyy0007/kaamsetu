import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="h-8 w-8" aria-hidden />
        </div>
        <h1>Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">The page you are looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/home">Go to Home</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Landing page
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
