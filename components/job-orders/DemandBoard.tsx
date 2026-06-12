"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, POSITION_LABEL, cn } from "@/components/ui";

export type DemandCard = {
  id: string;
  position: string;
  nationalityPref: string | null;
  quantity: number;
  salaryOffer: number | null;
  currency: string;
  contractMonths: number;
  targetTravelDate: string | null;
  specialRequirements: string | null;
  officeCountry: string;
  alreadyProposed: boolean;
};

type AvailableWorker = { id: string; fullName: string; position: string; nationality: string; status: string };

export function DemandBoard({ cards, availableWorkers }: { cards: DemandCard[]; availableWorkers: AvailableWorker[] }) {
  const [position, setPosition] = useState("all");
  const [proposeFor, setProposeFor] = useState<DemandCard | null>(null);

  const filtered = useMemo(
    () => cards.filter((c) => position === "all" || c.position === position),
    [cards, position],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="field-input w-auto" value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="all">كل المهن</option>
          {Object.entries(POSITION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">{filtered.length} أمر مفتوح</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.id} className="panel flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{POSITION_LABEL[c.position]}</p>
                {/* Office identity masked until shortlist (privacy by design) */}
                <p className="text-xs text-ink-muted">مكتب موثّق — {c.officeCountry}</p>
              </div>
              <Badge tone="gold">{c.quantity} مطلوب</Badge>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-ink-muted">الجنسية</dt>
              <dd>{c.nationalityPref ?? "أي جنسية"}</dd>
              <dt className="text-ink-muted">الراتب</dt>
              <dd>{c.salaryOffer ? `${c.salaryOffer} ${c.currency}` : "قابل للتفاوض"}</dd>
              <dt className="text-ink-muted">مدة العقد</dt>
              <dd>{c.contractMonths} شهرًا</dd>
              <dt className="text-ink-muted">السفر المستهدف</dt>
              <dd>{c.targetTravelDate ?? "مرن"}</dd>
            </dl>
            {c.specialRequirements ? (
              <p className="mt-3 rounded-lg bg-navy-950 p-2.5 text-xs leading-relaxed text-ink-muted">
                {c.specialRequirements}
              </p>
            ) : null}
            <button
              type="button"
              className={cn("mt-4", c.alreadyProposed ? "btn-secondary" : "btn-primary")}
              disabled={c.alreadyProposed}
              onClick={() => setProposeFor(c)}
            >
              {c.alreadyProposed ? "سبق أن قدّمت عرضًا ✓" : "تقديم عرض"}
            </button>
          </div>
        ))}
      </div>

      {proposeFor && (
        <ProposeDialog card={proposeFor} availableWorkers={availableWorkers} onClose={() => setProposeFor(null)} />
      )}
    </div>
  );
}

function ProposeDialog({
  card,
  availableWorkers,
  onClose,
}: {
  card: DemandCard;
  availableWorkers: AvailableWorker[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const matching = availableWorkers.filter((w) => w.position === card.position);
  const others = availableWorkers.filter((w) => w.position !== card.position);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) {
      toast.error("اختر مرشحًا واحدًا على الأقل");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOrderId: card.id, workerIds: [...selected], message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر إرسال العرض");
        return;
      }
      toast.success("أُرسل العرض إلى المكتب");
      onClose();
      router.push("/proposals");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <h2 className="mb-1 text-lg font-bold">تقديم عرض — {POSITION_LABEL[card.position]}</h2>
        <p className="mb-4 text-xs text-ink-muted">
          يُعرض على المكتب فقط المرشحون الذين تختارهم هنا، ولديهم جميعًا إقرارات موافقة موقّعة.
        </p>

        {matching.length + others.length === 0 ? (
          <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-300">
            لا يوجد لديك كوادر بحالة «متاح». فعّل ملفاتك (مع الموافقات) أولًا.
          </p>
        ) : (
          <div className="space-y-2">
            {[...matching, ...others].map((w) => (
              <label
                key={w.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition",
                  selected.has(w.id) ? "border-accent bg-accent/10" : "border-navy-700 hover:border-navy-800",
                )}
              >
                <span>
                  <span className="font-medium">{w.fullName}</span>
                  <span className="mr-2 text-xs text-ink-muted">
                    {POSITION_LABEL[w.position]} · {w.nationality}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={selected.has(w.id)}
                  onChange={() => toggle(w.id)}
                  className="h-4 w-4 accent-[#E8B86D]"
                />
              </label>
            ))}
          </div>
        )}

        <textarea
          rows={3}
          placeholder="رسالة للمكتب (اختياري)…"
          className="field-input mt-4"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className="mt-5 flex justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="btn-primary" disabled={busy || selected.size === 0} onClick={submit}>
            {busy ? "جارٍ الإرسال…" : `إرسال العرض (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
