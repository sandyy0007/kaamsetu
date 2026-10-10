import { Suspense } from "react";
import { ReelsView } from "@/components/features/reels-player";

export const metadata = { title: "Reels" };

export default function Page() {
  return (
    <Suspense>
      <ReelsView />
    </Suspense>
  );
}
