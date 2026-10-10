import { Suspense } from "react";
import { MarketView } from "@/components/features/market";

export const metadata = { title: "Market" };

export default function Page() {
  return (
    <Suspense>
      <MarketView />
    </Suspense>
  );
}
