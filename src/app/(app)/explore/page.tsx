import { Suspense } from "react";
import { ExploreView } from "@/components/features/explore";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreView />
    </Suspense>
  );
}
