"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VoiceButton } from "@/components/features/voice-button";
import { useI18n } from "@/components/providers/i18n";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section";
import { useGet } from "@/hooks/use-api";
import { detectIntent } from "@/lib/intents";
import type { OpportunityDTO } from "@/types/dto";
import { OpportunityCard } from "./cards";

export function QuickVoice({ variant = "farm" }: { variant?: "farm" | "pro" } = {}) {
  const router = useRouter();
  const { lang } = useI18n();
  const [heard, setHeard] = useState("");
  const farmChips =
    lang === "en"
      ? ["My crops", "Find buyers", "Government schemes", "Upcoming events", "Crop problem"]
      : lang === "hi"
        ? ["मेरी फसलें", "खरीदार खोजें", "सरकारी योजनाएँ", "आने वाले कार्यक्रम", "फसल में समस्या"]
        : ["Meri fasal", "Kharidaar dhoondho", "Sarkari yojana", "Events", "Fasal mein dikkat"];
  const proChips =
    lang === "en"
      ? ["Find work near me", "Post a job", "My service requests", "Government programmes", "Learn a skill"]
      : lang === "hi"
        ? ["मुझे काम चाहिए", "काम देना है", "मेरे अनुरोध", "सरकारी योजनाएँ", "हुनर सीखें"]
        : ["Kaam chahiye", "Kaam dena hai", "Mere requests", "Sarkari yojana", "Hunar seekhna hai"];
  const chips = variant === "pro" ? proChips : farmChips;
  const go = (text: string) => {
    const intent = detectIntent(text);
    router.push(intent.id === "FALLBACK" ? `/ai-assistant?q=${encodeURIComponent(text)}` : intent.href);
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <VoiceButton label="Speak your request" className="h-14 w-14 shrink-0 rounded-2xl bg-primary !text-primary-foreground hover:!bg-primary/90" onText={(t, final) => { setHeard(t); if (final && t) go(t); }} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{heard ? `“${heard}”` : lang === "en" ? "Tap the mic and speak" : lang === "hi" ? "माइक दबाकर बोलें" : "Mic dabakar bolein"}</p>
          <p className="text-sm text-muted-foreground">
            {variant === "pro"
              ? lang === "en"
                ? "Try: “Electrician near Churu”, “I need 3 workers tomorrow”"
                : "जैसे: “चूरू में इलेक्ट्रीशियन चाहिए”, “कल 3 मज़दूर चाहिए”"
              : lang === "en"
                ? "Try: “I have 50 quintal mustard”, “Wheat leaves are turning yellow”"
                : "जैसे: “मेरे पास 50 क्विंटल सरसों है”, “गेहूं की पत्तियां पीली हो रही हैं”"}
          </p>
        </div>
      </div>
      <div className="scroll-x mt-3 -mx-1 px-1">
        {chips.map((c) => (
          <button key={c} onClick={() => go(c)} className="tap rounded-full border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
            {c}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function OpportunityStrip({ title = "Opportunities for you" }: { title?: string } = {}) {
  const q = useGet<OpportunityDTO[]>("/opportunities");
  if (!q.data?.length) return null;
  return (
    <section>
      <SectionHeader title={title} href="/opportunities" />
      <div className="scroll-x -mx-4 px-4 pb-1 md:mx-0 md:px-0">
        {q.data.slice(0, 6).map((o) => (
          <div key={o.id} className="w-72">
            <OpportunityCard o={o} />
          </div>
        ))}
      </div>
    </section>
  );
}

