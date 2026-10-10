import { Suspense } from "react";
import { BuyersDiscover } from "@/components/features/discover";

export const metadata = { title: "Buyers" };

export default function BuyersPage() {
  return (
    <Suspense>
      <BuyersDiscover />
    </Suspense>
  );
}
