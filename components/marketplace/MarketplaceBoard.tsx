"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, EmptyState, POSITION_LABEL, cn } from "@/components/ui";
import type { MarketplaceCard } from "@/lib/db/marketplace";

type OpenJobOrder = { id: string; position: string; quantity: number; nationalityPref: string | null };

export function MarketplaceBoard({ cards, jobOrders }: { cards: MarketplaceCard[]; jobOrders: OpenJobOrder[] }) {
  const [position, setPosition] = useState("all");
  const [query, setQuery] = useState("");
  const [requestFor, setRequestFor] = useState<MarketplaceCard | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (position !== "all" && c.position !== position) return false;
      if (!q) return true;
      const haystack = [c.nationality, c.agencyName, c.agencyCountry, ...c.languages, ...c.skills]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cards, position, query]);

  if (cards.length === 0) {
    return (
      <EmptyState
        title="لا كوادر متاحة في السوق حاليًا"
        hint="حين تفعّل الوكالات كوادرها (بموافقات موقّعة) ستظهر هنا مباشرة."
      />
    );
  }

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
        <input
          className="field-input w-56"
          placeholder="بحث: جنسية، مهارة، وكالة…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-xs text-ink-muted">{filtered.length} مرشح متاح</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.id} className="panel flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{c.displayName}</p>
                <p className="text-xs text-ink-muted">
                  {POSITION_LABEL[c.position]} · {c.nationality}
                  {c.age ? ` · ${c.age} سنة` : ""}
                </p>
              </div>
              <Badge tone="green">متاح</Badge>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-ink-muted">الخبرة</dt>
              <dd>{c.experienceYears} سنة</dd>
              <dt className="text-ink-muted">اللغات</dt>
              <dd>{c.languages.join("، ") || "—"}</dd>
              <dt className="text-ink-muted">المهارات</dt>
              <dd className="col-span-1">{c.skills.join("، ") || "—"}</dd>
              <dt className="text-ink-muted">الراتب المتوقع</dt>
              <dd>{c.salaryExpectation ? `${c.salaryExpectation}$` : "قابل للتفاوض"}</dd>
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              وكالة {c.agencyName} — {c.agencyCountry}
            </p>
            <button type="button" className="btn-primary mt-4" onClick={() => setRequestFor(c)}>
              اختيار هذا المرشح
            </button>
          </div>
        ))}
      </div>

      {requestFor && (
        <RequestDialog card={requestFor} jobOrders={jobOrders} onClose={() => setRequestFor(null)} />
      )}
    </div>
  );
}

function RequestDialog({
  card,
  jobOrders,
  onClose,
}: {
  card: MarketplaceCard;
  jobOrders: OpenJobOrder[];
  onClose: () => void;
}) {
  const router = useRouter();
  const matching = jobOrders.filter((j) => j.position === card.position);
  const others = jobOrders.filter((j) => j.position !== card.position);
  const ordered = [...matching, ...others];
  const [jobOrderId, setJobOrderId] = useState(ordered[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!jobOrderId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: card.id, jobOrderId, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر إرسال الطلب");
        return;
      }
      toast.success("أُرسل الطلب — الملف الكامل متاح الآن في أمر التوظيف");
      onClose();
      router.push(`/job-orders/${data.jobOrderId}`);
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
        <h2 className="mb-1 text-lg font-bold">طلب {card.displayName}</h2>
        <p className="mb-4 text-xs text-ink-muted">
          {POSITION_LABEL[card.position]} · {card.nationality} · وكالة {card.agencyName}
        </p>

        {ordered.length === 0 ? (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-300">
            لا يوجد لديك أمر توظيف مفتوح. أنشئ أمرًا أولًا ثم اطلب المرشح.
            <Link href="/job-orders/new" className="btn-primary mt-3 block text-center">
              إنشاء أمر توظيف
            </Link>
          </div>
        ) : (
          <>
            <span className="field-label">أمر التوظيف</span>
            <div className="space-y-2">
              {ordered.map((j) => (
                <label
                  key={j.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition",
                    jobOrderId === j.id ? "border-accent bg-accent/10" : "border-navy-700 hover:border-navy-800",
                  )}
                >
                  <span>
                    <span className="font-medium">
                      {POSITION_LABEL[j.position]} × {j.quantity}
                    </span>
                    <span className="mr-2 text-xs text-ink-muted">{j.nationalityPref ?? "أي جنسية"}</span>
                    {j.position === card.position ? (
                      <span className="mr-2 text-xs text-emerald-300">مطابق للمهنة</span>
                    ) : null}
                  </span>
                  <input
                    type="radio"
                    name="jobOrder"
                    checked={jobOrderId === j.id}
                    onChange={() => setJobOrderId(j.id)}
                    className="h-4 w-4 accent-[#E8B86D]"
                  />
                </label>
              ))}
            </div>

            <textarea
              rows={3}
              placeholder="رسالة للوكالة (اختياري)…"
              className="field-input mt-4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </>
        )}

        <div className="mt-5 flex justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          {ordered.length > 0 && (
            <button type="button" className="btn-primary" disabled={busy || !jobOrderId} onClick={submit}>
              {busy ? "جارٍ الإرسال…" : "إرسال الطلب"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
