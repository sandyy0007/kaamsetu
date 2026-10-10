import { Suspense } from "react";
import { CreateHub } from "@/components/features/create-hub";

export const metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <Suspense>
      <CreateHub />
    </Suspense>
  );
}
