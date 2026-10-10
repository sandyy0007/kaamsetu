"use client";
import { useSearchParams } from "next/navigation";
import { CropDetailView } from "./farm-views";

export function CropDetailLoader({ id }: { id: string }) {
  const sp = useSearchParams();
  return <CropDetailView id={id} cycleId={sp.get("cycle") ?? undefined} />;
}
