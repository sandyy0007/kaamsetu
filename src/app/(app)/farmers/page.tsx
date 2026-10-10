import { Suspense } from "react";
import { FarmersDiscover } from "@/components/features/discover";

export const metadata = { title: "Find farmers" };

export default function FarmersPage() {
  return (
    <Suspense>
      <FarmersDiscover />
    </Suspense>
  );
}
