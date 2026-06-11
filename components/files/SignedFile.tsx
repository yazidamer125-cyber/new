"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

async function fetchSignedUrl(objectKey: string, name?: string): Promise<string | null> {
  const params = new URLSearchParams({ key: objectKey });
  if (name) params.set("name", name);
  const res = await fetch(`/api/files/sign?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** Opens a document via a fresh 10-minute signed URL (never a stored public URL). */
export function SignedFileLink({ objectKey, name, children }: { objectKey: string; name?: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        const url = await fetchSignedUrl(objectKey, name);
        setBusy(false);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else toast.error("تعذّر فتح الملف");
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}

/** Worker photo thumbnail rendered from a short-lived signed URL. */
export function SignedImage({ objectKey, alt, className }: { objectKey: string | null; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (objectKey) {
      void fetchSignedUrl(objectKey).then((url) => {
        if (!cancelled) setSrc(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  if (!objectKey || !src) {
    return (
      <div className={`flex items-center justify-center bg-navy-800 text-ink-muted ${className ?? ""}`}>☺</div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived; next/image caching would break them
  return <img src={src} alt={alt} className={className} />;
}
