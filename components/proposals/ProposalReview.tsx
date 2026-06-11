"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, POSITION_LABEL, cn, type BadgeTone } from "@/components/ui";
import { SignedImage } from "@/components/files/SignedFile";
import { Thread } from "@/components/messages/Thread";

export type ProposalView = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  agencyName: string;
  agencyCountry: string;
  threadId: string | null;
  workers: {
    id: string;
    fullName: string;
    nationality: string;
    position: string;
    experienceYears: number;
    languages: string[];
    skills: string[];
    salaryExpectation: number | null;
    photoKey: string | null;
    hasConsent: boolean;
    consentSignedDate: string | null;
    markStatus: string;
  }[];
};

/** Office-side review card: shortlist/accept/reject + per-candidate marking. */
export function ProposalReview({
  proposal,
  statusBadge,
}: {
  proposal: ProposalView;
  statusBadge: { label: string; tone: BadgeTone };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const open = !["accepted", "rejected", "withdrawn"].includes(proposal.status);

  async function setStatus(status: string) {
    setBusy(status);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر التحديث");
        return;
      }
      toast.success(status === "accepted" ? "قُبل العرض وأُنشئت ملفات الإجراءات" : "تم التحديث");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function markWorker(workerId: string, status: "selected" | "rejected") {
    const res = await fetch(`/api/proposals/${proposal.id}/workers/${workerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data?.error?.message ?? "تعذّر التحديث");
      return;
    }
    router.refresh();
  }

  return (
    <div className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {proposal.agencyName} <span className="text-xs text-ink-muted">({proposal.agencyCountry})</span>
          </p>
          {proposal.message ? <p className="mt-1 text-sm text-ink-muted">{proposal.message}</p> : null}
        </div>
        <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {proposal.workers.map((w) => (
          <div
            key={w.id}
            className={cn(
              "rounded-lg border p-4",
              w.markStatus === "selected"
                ? "border-emerald-700 bg-emerald-950/20"
                : w.markStatus === "rejected"
                  ? "border-red-900/60 bg-red-950/20 opacity-60"
                  : "border-navy-700",
            )}
          >
            <div className="flex items-start gap-3">
              <SignedImage objectKey={w.photoKey} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{w.fullName}</p>
                <p className="text-xs text-ink-muted">
                  {POSITION_LABEL[w.position]} · {w.nationality} · خبرة {w.experienceYears} سنة
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  لغات: {w.languages.join("، ") || "—"} · مهارات: {w.skills.join("، ") || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {w.salaryExpectation ? <Badge tone="gold">يتوقع {w.salaryExpectation}$</Badge> : null}
                  {w.hasConsent ? (
                    <Badge tone="green">موافقة موقّعة {w.consentSignedDate ?? ""}</Badge>
                  ) : (
                    <Badge tone="red">بدون موافقة</Badge>
                  )}
                </div>
              </div>
            </div>
            {open && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1 py-1.5 text-xs"
                  onClick={() => void markWorker(w.id, "selected")}
                >
                  اختيار ✓
                </button>
                <button
                  type="button"
                  className="btn-danger flex-1 py-1.5 text-xs"
                  onClick={() => void markWorker(w.id, "rejected")}
                >
                  استبعاد
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy-800 pt-4">
        <button type="button" className="btn-secondary text-xs" onClick={() => setShowThread((s) => !s)}>
          {showThread ? "إخفاء المحادثة" : "محادثة الوكالة 💬"}
        </button>
        {open && (
          <div className="flex flex-wrap gap-2">
            {proposal.status === "pending" && (
              <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void setStatus("shortlisted")}>
                {busy === "shortlisted" ? "…" : "قائمة مختصرة"}
              </button>
            )}
            <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => void setStatus("accepted")}>
              {busy === "accepted" ? "…" : "قبول العرض"}
            </button>
            <button type="button" className="btn-danger" disabled={busy !== null} onClick={() => void setStatus("rejected")}>
              {busy === "rejected" ? "…" : "رفض"}
            </button>
          </div>
        )}
      </div>

      {showThread && proposal.threadId ? (
        <div className="mt-4">
          <Thread threadId={proposal.threadId} />
        </div>
      ) : null}
    </div>
  );
}
