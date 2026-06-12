"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, STAGE_LABEL, OKB_STATUS_BADGE, POSITION_LABEL, cn } from "@/components/ui";

const PIPELINE: string[] = ["contract", "visa", "medical", "ticketing", "okb", "traveled", "arrived"];
const AIRLINES = ["etihad", "air_arabia", "flydubai", "flynas", "qatar", "other"] as const;
const AIRLINE_LABEL: Record<string, string> = {
  etihad: "الاتحاد",
  air_arabia: "العربية للطيران",
  flydubai: "فلاي دبي",
  flynas: "طيران ناس",
  qatar: "القطرية",
  other: "أخرى",
};

export type PlacementCard = {
  id: string;
  stage: string;
  notes: string | null;
  stageUpdatedAt: string;
  workerName: string;
  workerPosition: string;
  workerNationality: string;
  counterpartName: string;
  okb: { id: string; status: string; airline: string; travelDate: string | null }[];
};

export function PipelineBoard({ cards, canManage }: { cards: PlacementCard[]; canManage: boolean }) {
  const cancelled = cards.filter((c) => c.stage === "cancelled");
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {PIPELINE.map((stage) => {
          const inStage = cards.filter((c) => c.stage === stage);
          return (
            <div key={stage} className="w-72 shrink-0">
              <div className="mb-3 flex items-center justify-between rounded-lg bg-navy-900 px-3 py-2">
                <p className="text-sm font-semibold">{STAGE_LABEL[stage]}</p>
                <span className="rounded-full bg-navy-800 px-2 text-xs text-ink-muted">{inStage.length}</span>
              </div>
              <div className="space-y-3">
                {inStage.map((c) => (
                  <PlacementCardView key={c.id} card={c} canManage={canManage} />
                ))}
              </div>
            </div>
          );
        })}
        {cancelled.length > 0 && (
          <div className="w-72 shrink-0 opacity-60">
            <div className="mb-3 rounded-lg bg-navy-900 px-3 py-2">
              <p className="text-sm font-semibold">{STAGE_LABEL.cancelled}</p>
            </div>
            <div className="space-y-3">
              {cancelled.map((c) => (
                <PlacementCardView key={c.id} card={c} canManage={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlacementCardView({ card, canManage }: { card: PlacementCard; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showOkb, setShowOkb] = useState(false);
  const idx = PIPELINE.indexOf(card.stage);
  const nextStage = idx >= 0 && idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;
  const daysInStage = Math.floor((Date.now() - new Date(card.stageUpdatedAt).getTime()) / 86_400_000);

  async function move(stage: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/placements/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error?.message ?? "تعذّر التحديث");
        return;
      }
      toast.success(`انتقل إلى: ${STAGE_LABEL[stage]}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-4">
      <p className="font-semibold">{card.workerName}</p>
      <p className="text-xs text-ink-muted">
        {POSITION_LABEL[card.workerPosition]} · {card.workerNationality}
      </p>
      <p className="mt-1 text-xs text-ink-muted">مع: {card.counterpartName}</p>
      <p className={cn("mt-1 text-[11px]", daysInStage > 14 ? "text-amber-300" : "text-ink-muted")}>
        {daysInStage} يوم في هذه المرحلة
      </p>

      {card.okb.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.okb.map((o) => {
            const b = OKB_STATUS_BADGE[o.status];
            return (
              <Badge key={o.id} tone={b.tone}>
                {b.label} · {AIRLINE_LABEL[o.airline]}
              </Badge>
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="mt-3 space-y-2 border-t border-navy-800 pt-3">
          {nextStage && (
            <button type="button" className="btn-primary w-full py-1.5 text-xs" disabled={busy} onClick={() => void move(nextStage)}>
              {busy ? "…" : `← ${STAGE_LABEL[nextStage]}`}
            </button>
          )}
          {["ticketing", "okb"].includes(card.stage) && (
            <button type="button" className="btn-secondary w-full py-1.5 text-xs" onClick={() => setShowOkb(true)}>
              + طلب OKB
            </button>
          )}
          {!["traveled", "arrived"].includes(card.stage) && (
            <button type="button" className="btn-danger w-full py-1.5 text-xs" disabled={busy} onClick={() => void move("cancelled")}>
              إلغاء الملف
            </button>
          )}
        </div>
      )}

      {showOkb && <OkbDialog placementId={card.id} onClose={() => setShowOkb(false)} />}
    </div>
  );
}

function OkbDialog({ placementId, onClose }: { placementId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ airline: "etihad", flightNo: "", pnr: "", travelDate: "", route: "" });

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/okb-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placementId,
          airline: form.airline,
          flightNo: form.flightNo || null,
          pnr: form.pnr || null,
          travelDate: form.travelDate || null,
          route: form.route || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data?.error?.message ?? "تعذّر إنشاء الطلب");
        return;
      }
      toast.success("أُنشئ طلب OKB");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h2 className="text-lg font-bold">طلب OK to Board</h2>
        <label className="block">
          <span className="field-label">شركة الطيران</span>
          <select className="field-input" value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })}>
            {AIRLINES.map((a) => (
              <option key={a} value={a}>
                {AIRLINE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="field-label">رقم الرحلة</span>
            <input dir="ltr" className="field-input" value={form.flightNo} onChange={(e) => setForm({ ...form, flightNo: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">PNR</span>
            <input dir="ltr" className="field-input" value={form.pnr} onChange={(e) => setForm({ ...form, pnr: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">تاريخ السفر</span>
            <input dir="ltr" type="date" className="field-input" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">المسار</span>
            <input dir="ltr" className="field-input" placeholder="ADD → AMM" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-between gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "…" : "إنشاء الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}
