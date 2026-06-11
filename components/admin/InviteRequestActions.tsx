"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InvitationForm } from "./InvitationForm";

export function InviteRequestActions({
  requestId,
  email,
  orgType,
}: {
  requestId: string;
  email: string;
  orgType: string;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "approved" | "dismissed") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/invite-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("تعذّر التحديث");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (inviting) {
    return (
      <div className="w-full">
        <InvitationForm defaultEmail={email} defaultOrgType={orgType} onDone={() => void setStatus("approved")} />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="btn-primary py-1.5 text-xs" disabled={busy} onClick={() => setInviting(true)}>
        إنشاء دعوة
      </button>
      <button type="button" className="btn-secondary py-1.5 text-xs" disabled={busy} onClick={() => void setStatus("dismissed")}>
        تجاهل
      </button>
    </div>
  );
}
