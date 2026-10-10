import { Suspense } from "react";
import { ExpertsView } from "@/components/features/experts";

export const metadata = { title: "Experts" };

export default function ExpertsPage() {
  return (
    <Suspense>
      <ExpertsView />
    </Suspense>
  );
}
