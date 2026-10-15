"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Globe2,
  Mic,
  MicOff,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  SpeechRecognitionSession,
  isSpeechRecognitionSupported,
  type SpeechLanguage,
  type SpeechStatus,
} from "@/lib/voice/speech-recognition";
import { resolveVoiceIntent } from "@/lib/voice/intent-resolver";
import type { ResolvedVoiceAction } from "@/lib/voice/intent-schema";
import { cn } from "@/lib/utils";

interface VoiceSearchModalProps {
  open: boolean;
  onClose: () => void;
  initialLanguage?: "hi" | "en" | "hinglish";
}

const SAMPLE_COMMANDS: { label: string; lang: string }[] = [
  { label: "मुझे इलेक्ट्रीशियन चाहिए", lang: "hi" },
  { label: "Find carpenter near me", lang: "en" },
  { label: "Jaipur mein driver ki job", lang: "hinglish" },
  { label: "Meri profile kholo", lang: "hinglish" },
  { label: "Following list open karo", lang: "hinglish" },
  { label: "Open my messages", lang: "en" },
];

export function VoiceSearchModal({ open, onClose, initialLanguage = "hi" }: VoiceSearchModalProps) {
  const router = useRouter();
  const [lang, setLang] = useState<SpeechLanguage>(
    initialLanguage === "en" ? "en-IN" : "hi-IN"
  );
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolvedAction, setResolvedAction] = useState<ResolvedVoiceAction | null>(null);

  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const supported = isSpeechRecognitionSupported();

  const handleTranscript = useCallback(async (text: string, _isFinal: boolean) => {
    setTranscript(text);
    setErrorMsg(null);

    if (text.trim().length >= 3) {
      setResolving(true);
      try {
        const action = await resolveVoiceIntent(text, { language: lang });
        setResolvedAction(action);
      } catch {
        // keep previous action
      } finally {
        setResolving(false);
      }
    }
  }, [lang]);

  const startListening = useCallback(() => {
    setErrorMsg(null);
    setResolvedAction(null);

    if (sessionRef.current) {
      sessionRef.current.abort();
    }

    const session = new SpeechRecognitionSession(lang, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onTranscript: ({ transcript: text, isFinal }) => {
        void handleTranscript(text, isFinal);
      },
      onError: ({ message }) => {
        setErrorMsg(message);
        setStatus("error");
      },
      onEnd: () => {
        setStatus("idle");
      },
    });

    sessionRef.current = session;
    session.start();
  }, [lang, handleTranscript]);

  const stopListening = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (open) {
      setTranscript("");
      setResolvedAction(null);
      setErrorMsg(null);
      if (supported) {
        startListening();
      } else {
        setStatus("unsupported");
      }
    } else {
      sessionRef.current?.abort();
      sessionRef.current = null;
      setStatus("idle");
    }

    return () => {
      sessionRef.current?.abort();
      sessionRef.current = null;
    };
  }, [open, supported, startListening]);

  const handleLanguageChange = (newLang: SpeechLanguage) => {
    setLang(newLang);
    sessionRef.current?.setLanguage(newLang);
    if (status === "listening") {
      stopListening();
      setTimeout(startListening, 150);
    }
  };

  const handleExecuteAction = () => {
    if (resolvedAction) {
      onClose();
      router.push(resolvedAction.targetUrl);
    } else if (transcript.trim()) {
      onClose();
      router.push(`/explore?q=${encodeURIComponent(transcript.trim())}`);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Voice Search / बोलकर खोजें" size="md">
      <div className="space-y-6 pt-2">
        {/* Language selector */}
        <div className="flex items-center justify-between border-b pb-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <Globe2 className="h-4 w-4" /> Language:
          </span>
          <div className="flex gap-1" role="radiogroup" aria-label="Speech Language">
            <button
              type="button"
              role="radio"
              aria-checked={lang === "hi-IN"}
              onClick={() => handleLanguageChange("hi-IN")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                lang === "hi-IN" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              हिन्दी / Hinglish
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={lang === "en-IN"}
              onClick={() => handleLanguageChange("en-IN")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                lang === "en-IN" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              )}
            >
              English
            </button>
          </div>
        </div>

        {/* Central interactive microphone display */}
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="relative mb-4">
            {status === "listening" && (
              <span className="absolute -inset-3 rounded-full bg-danger/20 animate-ping opacity-75" />
            )}
            <button
              type="button"
              onClick={status === "listening" ? stopListening : startListening}
              aria-label={status === "listening" ? "Stop listening" : "Start speaking"}
              className={cn(
                "relative grid h-20 w-20 place-items-center rounded-full shadow-lg transition-transform active:scale-95",
                status === "listening"
                  ? "bg-danger text-white animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {status === "listening" ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
          </div>

          <p className="text-sm font-bold">
            {status === "listening"
              ? "Listening… speak naturally / सुन रहे हैं…"
              : status === "processing" || resolving
              ? "Interpreting request… / समझ रहे हैं…"
              : status === "unsupported"
              ? "Voice input not supported on this browser"
              : "Tap microphone to speak"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search trades, jobs, profiles or navigate screens
          </p>
        </div>

        {/* Live / Editable Transcript */}
        <div className="space-y-2">
          <label htmlFor="voice-transcript-input" className="block text-xs font-semibold text-muted-foreground">
            Recognized speech / बोली गई बात:
          </label>
          <div className="relative">
            <input
              id="voice-transcript-input"
              type="text"
              value={transcript}
              onChange={(e) => void handleTranscript(e.target.value, false)}
              placeholder="Speak something like 'Mujhe electrician chahiye' or type here…"
              className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {transcript && (
              <button
                type="button"
                onClick={() => {
                  setTranscript("");
                  setResolvedAction(null);
                }}
                aria-label="Clear input"
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error notice */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMsg}</p>
              <button
                type="button"
                onClick={startListening}
                className="mt-1.5 inline-flex items-center gap-1 font-bold underline hover:no-underline"
              >
                <RotateCcw className="h-3 w-3" /> Retry microphone
              </button>
            </div>
          </div>
        )}

        {/* Parsed action card preview */}
        {resolvedAction && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Intended Action:
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Match {Math.round(resolvedAction.confidence * 100)}%
              </span>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{resolvedAction.displayTitle}</p>
              <p className="text-xs text-muted-foreground">{resolvedAction.displayDescription}</p>
            </div>
            <Button
              onClick={handleExecuteAction}
              className="w-full justify-center text-sm font-bold min-h-10"
            >
              Open Results <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        )}

        {/* Sample queries chips */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground">Try saying / यह बोलकर देखें:</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                type="button"
                onClick={() => void handleTranscript(cmd.label, true)}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                &ldquo;{cmd.label}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Fallback general search action */}
        {transcript && !resolvedAction && (
          <Button
            variant="outline"
            onClick={handleExecuteAction}
            className="w-full justify-center text-sm font-semibold"
          >
            <Search className="h-4 w-4 mr-1.5" /> Search for &ldquo;{transcript}&rdquo;
          </Button>
        )}
      </div>
    </Sheet>
  );
}

