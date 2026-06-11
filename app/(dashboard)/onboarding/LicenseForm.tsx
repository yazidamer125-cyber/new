"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUploader } from "@/components/files/FileUploader";
import { Field } from "@/components/ui";

export function LicenseForm({
  defaultLicenseNumber,
  alreadySubmitted,
}: {
  defaultLicenseNumber: string;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [licenseNumber, setLicenseNumber] = useState(defaultLicenseNumber);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (alreadySubmitted) {
    return <p className="text-sm text-emerald-300">تم استلام الرخصة وهي قيد المراجعة.</p>;
  }

  async function submit() {
    if (!licenseNumber || !docKey) {
      toast.error("أدخل رقم الترخيص وارفع ملف الرخصة أولًا");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/org/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseNumber, licenseDocKey: docKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر إرسال الرخصة");
        return;
      }
      toast.success("أُرسلت الرخصة للمراجعة");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="رقم الترخيص الرسمي">
        <input dir="ltr" className="field-input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
      </Field>
      <FileUploader
        kind="license"
        accept="application/pdf,image/jpeg,image/png"
        label="رفع ملف الرخصة (PDF / صورة)"
        onUploaded={(key) => setDocKey(key)}
      />
      <button type="button" className="btn-primary" disabled={busy || !docKey || !licenseNumber} onClick={submit}>
        {busy ? "جارٍ الإرسال…" : "إرسال للمراجعة"}
      </button>
    </div>
  );
}
