import { Suspense } from "react";
import { MessagesView } from "@/components/features/messages";

export const metadata = { title: "Messages" };

export default function Page() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
