"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function WithdrawButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    if (!confirm("سحب العرض؟ سيعود المرشحون إلى حالة «متاح».")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "withdrawn" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error?.message ?? "تعذّر السحب");
        return;
      }
      toast.success("سُحب العرض");
      router.push("/proposals");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-danger text-xs" disabled={busy} onClick={() => void withdraw()}>
      {busy ? "…" : "سحب العرض"}
    </button>
  );
}
