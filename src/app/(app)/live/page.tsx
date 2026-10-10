import { Suspense } from "react";
import { LiveListView } from "@/components/features/events";

export const metadata = { title: "Live" };

export default function Page() {
  return (
    <Suspense>
      <LiveListView />
    </Suspense>
  );
}
