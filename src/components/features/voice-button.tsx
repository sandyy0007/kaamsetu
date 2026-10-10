"use client";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { SPEECH_LOCALE } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecCtor = new () => RecognitionLike;

function getCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice input via the browser's Web Speech API (Hindi / English / Hinglish).
 * Transcripts are only ever placed in a text box for the user to review — nothing is auto-submitted.
 * When unsupported (or permission denied) the user is told and can simply type.
 */
export function VoiceButton({ onText, className, label = "Speak" }: { onText: (text: string, final: boolean) => void; className?: string; label?: string }) {
  const { lang, t } = useI18n();
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const rec = useRef<RecognitionLike | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      toast({ kind: "info", title: t("voice.unsupported") });
      return;
    }
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = SPEECH_LOCALE[lang];
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        text += res[0]?.transcript ?? "";
        final = final || Boolean(res.isFinal);
      }
      onText(text.trim(), final);
    };
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast({ kind: "error", title: "Microphone permission is blocked", description: "Allow the microphone in your browser settings, or type instead." });
      else if (e.error !== "aborted" && e.error !== "no-speech") toast({ kind: "error", title: "Voice input stopped", description: "Please try again or type instead." });
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang, listening, onText, t, toast]);

  return (
    <button type="button" onClick={toggle} aria-pressed={listening} aria-label={listening ? "Stop listening" : label} title={listening ? t("voice.listening") : label} className={cn("tap grid place-items-center rounded-xl transition-colors", listening ? "bg-danger text-white animate-pulse-ring" : "text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
