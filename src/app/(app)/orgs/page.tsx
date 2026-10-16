"use client";

import { useSearchParams } from "next/navigation";
import { OrgProfileView } from "@/components/features/other-profiles";
import { EmptyState } from "@/components/ui/state";
import { Card } from "@/components/ui/card";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/ui/skeleton";

function OrgsContent() {
  const sp = useSearchParams();
  const id = sp.get("id");
  if (id) {
    return <OrgProfileView id={id} />;
  }
  return (
    <Card className="p-5">
      <EmptyState title="Organisation profile" description="Specify an organisation to view their profile." />
    </Card>
  );
}

export default function OrgsPage() {
  return (
    <Suspense fallback={<CardSkeleton lines={4} />}>
      <OrgsContent />
    </Suspense>
  );
}

