/**
 * KaamSetu Speech Recognition Abstraction.
 * Supports Web Speech API across modern mobile & desktop browsers.
 * Languages: Hindi (hi-IN), Indian English (en-IN), and Hinglish.
 */

export type SpeechLanguage = "hi-IN" | "en-IN" | "en-US";

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export type SpeechStatus = "idle" | "listening" | "processing" | "unsupported" | "error";

export interface SpeechRecognitionCallbacks {
  onStatusChange?: (status: SpeechStatus) => void;
  onTranscript?: (result: SpeechRecognitionResult) => void;
  onError?: (error: { code: string; message: string }) => void;
  onEnd?: () => void;
}

interface WebkitSpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence?: number;
      };
    };
  };
}

type SpeechRecognitionCtor = new () => WebkitSpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export class SpeechRecognitionSession {
  private recognition: WebkitSpeechRecognitionLike | null = null;
  private status: SpeechStatus = "idle";
  private callbacks: SpeechRecognitionCallbacks;
  private lang: SpeechLanguage;

  constructor(lang: SpeechLanguage = "hi-IN", callbacks: SpeechRecognitionCallbacks = {}) {
    this.lang = lang;
    this.callbacks = callbacks;
  }

  public getStatus(): SpeechStatus {
    return this.status;
  }

  public setLanguage(lang: SpeechLanguage) {
    this.lang = lang;
    if (this.recognition && this.status === "listening") {
      this.recognition.lang = lang;
    }
  }

  public start(): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.setStatus("unsupported");
      this.callbacks.onError?.({
        code: "UNSUPPORTED",
        message: "Speech recognition is not supported on this browser or platform. Please use text search.",
      });
      return false;
    }

    if (this.status === "listening") {
      return true;
    }

    try {
      const rec = new Ctor();
      rec.lang = this.lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.setStatus("listening");
      };

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interimText = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item) continue;
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            finalText += text;
          } else {
            interimText += text;
          }
        }

        const effective = (finalText || interimText).trim();
        if (effective) {
          this.callbacks.onTranscript?.({
            transcript: effective,
            isFinal: Boolean(finalText),
          });
        }
      };

      rec.onerror = (event) => {
        const err = event.error;
        this.setStatus("error");

        let userMsg = "Speech recognition encountered an issue. Please try again.";
        if (err === "not-allowed" || err === "service-not-allowed") {
          userMsg = "Microphone access was denied. Please allow microphone permissions in settings or type your search.";
        } else if (err === "no-speech") {
          userMsg = "No speech was detected. Please tap the microphone and speak clearly.";
        } else if (err === "network") {
          userMsg = "Voice recognition service network error. Check your connection or type instead.";
        }

        this.callbacks.onError?.({
          code: err,
          message: userMsg,
        });
      };

      rec.onend = () => {
        if (this.status === "listening") {
          this.setStatus("idle");
        }
        this.callbacks.onEnd?.();
      };

      this.recognition = rec;
      rec.start();
      return true;
    } catch (e) {
      this.setStatus("error");
      this.callbacks.onError?.({
        code: "START_FAILED",
        message: e instanceof Error ? e.message : "Failed to start speech recognition.",
      });
      return false;
    }
  }

  public stop() {
    if (this.recognition && this.status === "listening") {
      try {
        this.setStatus("processing");
        this.recognition.stop();
      } catch {
        this.setStatus("idle");
      }
    }
  }

  public abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      } finally {
        this.setStatus("idle");
      }
    }
  }

  private setStatus(status: SpeechStatus) {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }
}

