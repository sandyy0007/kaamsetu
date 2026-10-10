import { Suspense } from "react";
import { AdminView } from "@/components/features/admin";

export const metadata = { title: "Admin" };

export default function Page() {
  return (
    <Suspense>
      <AdminView />
    </Suspense>
  );
}
