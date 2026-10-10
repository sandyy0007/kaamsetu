import { Suspense } from "react";
import { ProfessionalsDiscover } from "@/components/features/professionals-discover";

export const metadata = { title: "Find professionals" };

export default function ProfessionalsPage() {
  return (
    <Suspense>
      <ProfessionalsDiscover />
    </Suspense>
  );
}
