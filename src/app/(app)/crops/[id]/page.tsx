import { Suspense } from "react";
import { CropDetailLoader } from "@/components/features/farm-views-client";

export default async function CropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CropDetailLoader id={id} />
    </Suspense>
  );
}
