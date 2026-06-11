"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function OrgReviewActions({ orgId, hasLicense }: { orgId: string; hasLicense: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/verify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر التوثيق");
        return;
      }
      toast.success("تم توثيق المنشأة");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 3) {
      toast.error("اذكر سبب الرفض");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error?.message ?? "تعذّر الرفض");
        return;
      }
      toast.success("رُفض الطلب وأُبلغت المنشأة");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (rejecting) {
    return (
      <div className="w-full max-w-sm space-y-2">
        <textarea
          rows={2}
          className="field-input"
          placeholder="سبب الرفض (يصل للمنشأة)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="btn-danger flex-1" disabled={busy} onClick={() => void reject()}>
            تأكيد الرفض
          </button>
          <button type="button" className="btn-secondary" onClick={() => setRejecting(false)}>
            تراجع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="btn-primary" disabled={busy || !hasLicense} onClick={() => void verify()}>
        {busy ? "…" : "توثيق ✓"}
      </button>
      <button type="button" className="btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
        رفض
      </button>
    </div>
  );
}
