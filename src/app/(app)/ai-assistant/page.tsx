import { Suspense } from "react";
import { AiAssistantView } from "@/components/features/ai-assistant";

export const metadata = { title: "AI Assistant" };

export default function Page() {
  return (
    <Suspense>
      <AiAssistantView />
    </Suspense>
  );
}
