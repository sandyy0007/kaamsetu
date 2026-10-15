"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProfessionalProfileView } from "@/components/features/professional-profile";
import { useRouteEntityId } from "@/hooks/use-route-entity-id";

export function FarmerProfileRedirect({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const id = useRouteEntityId(initialId);

  useEffect(() => {
    if (id && id !== "_default") {
      router.replace(`/professionals/${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  return <ProfessionalProfileView id={id} />;
}

