"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function InvitationForm({
  defaultEmail = "",
  defaultOrgType = "recruitment_office",
  onDone,
}: {
  defaultEmail?: string;
  defaultOrgType?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [orgType, setOrgType] = useState(defaultOrgType);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر إنشاء الدعوة");
        return;
      }
      setLink(data.inviteLink);
      toast.success("أُنشئت الدعوة — انسخ الرابط");
      router.refresh();
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          dir="ltr"
          type="email"
          className="field-input max-w-xs"
          placeholder="email@org.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="field-input w-auto" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          <option value="recruitment_office">مكتب استقدام</option>
          <option value="source_agency">وكالة توريد</option>
        </select>
        <button type="button" className="btn-primary" disabled={busy || !email} onClick={() => void create()}>
          {busy ? "…" : "إنشاء دعوة"}
        </button>
      </div>
      {link && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-accent">
            {link}
          </code>
          <button
            type="button"
            className="btn-secondary py-1 text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("نُسخ الرابط");
            }}
          >
            نسخ
          </button>
        </div>
      )}
    </div>
  );
}
