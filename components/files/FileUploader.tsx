"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  kind: "license" | "consent" | "worker_photo" | "worker_video" | "document";
  workerId?: string;
  accept: string; // e.g. "application/pdf"
  label: string;
  onUploaded: (key: string, fileName: string) => void;
};

/**
 * Direct browser → R2 upload: asks /api/uploads/sign for a 10-minute signed
 * PUT URL, then PUTs the file. Only the object key is ever stored.
 */
export function FileUploader({ kind, workerId, accept, label, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, workerId, contentType: file.type, fileName: file.name }),
      });
      if (!signRes.ok) {
        const data = await signRes.json().catch(() => null);
        throw new Error(data?.error?.message ?? "تعذّر تجهيز الرفع");
      }
      const { key, url } = (await signRes.json()) as { key: string; url: string };
      const putRes = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("فشل رفع الملف إلى المخزن");
      setDone(file.name);
      onUploaded(key, file.name);
      toast.success("تم رفع الملف");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn-secondary w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "جارٍ الرفع…" : done ? `✓ ${done}` : label}
      </button>
    </div>
  );
}
