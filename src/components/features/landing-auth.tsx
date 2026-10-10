"use client";
import { ButtonLink } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";

export function LandingAuthButtons({ compact }: { compact?: boolean }) {
  const { data: me } = useMe();
  if (me) return <ButtonLink href="/home" size={compact ? "sm" : "md"}>Open app</ButtonLink>;
  return (
    <>
      <ButtonLink href="/login" size="sm" variant="outline" className="bg-card/80 backdrop-blur">
        Sign in
      </ButtonLink>
      <ButtonLink href="/register" size="sm" className="hidden sm:inline-flex">
        Join free
      </ButtonLink>
    </>
  );
}
