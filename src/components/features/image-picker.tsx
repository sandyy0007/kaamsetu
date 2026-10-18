"use client";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadFile, resolveMediaUrl } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/utils";

/** Pick/capture a photo → compress in the browser → upload through the storage abstraction → report its URL. */
export function ImagePicker({ value, onChange, label = "Add a photo", className, error }: { value?: string; onChange: (url: string | undefined) => void; label?: string; className?: string; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const small = await compressImage(f);
      const r = await uploadFile(small);
      onChange(r.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className={className}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label={label} tabIndex={-1} />
      {value ? (
        <div className="relative inline-block">
          <img src={resolveMediaUrl(value)} alt="Attached photo" className="h-32 w-auto max-w-full rounded-xl border object-cover" />
          <button type="button" onClick={() => onChange(undefined)} aria-label="Remove photo" className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-card shadow-pop hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={cn("tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary", (err || error) && "border-danger")}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          {busy ? "Uploading…" : label}
          {!busy && <ImagePlus className="h-4 w-4 opacity-60" />}
        </button>
      )}
      {(err || error) && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {err ?? error}
        </p>
      )}
    </div>
  );
}
