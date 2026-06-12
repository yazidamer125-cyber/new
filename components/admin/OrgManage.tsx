"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Organization } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------

export function OrgEditForm({ org }: { org: Organization }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [country, setCountry] = useState(org.country);
  const [city, setCity] = useState(org.city ?? "");
  const [licenseNumber, setLicenseNumber] = useState(org.licenseNumber ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          country: country.trim(),
          city: city.trim() || null,
          licenseNumber: licenseNumber.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error?.message ?? "تعذّر الحفظ"); return; }
      toast.success("تم حفظ التعديلات");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="panel p-6">
      <h2 className="mb-4 font-semibold">تعديل البيانات الأساسية</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">اسم المنشأة</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">الدولة</span>
          <input className="field-input" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">المدينة (اختياري)</span>
          <input className="field-input" value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">رقم الترخيص (اختياري)</span>
          <input className="field-input" dir="ltr" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </label>
      </div>
      <button type="button" className="btn-primary mt-5" disabled={busy} onClick={() => void save()}>
        {busy ? "جارٍ الحفظ…" : "حفظ التعديلات"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspend / unsuspend
// ---------------------------------------------------------------------------

export function OrgSuspendToggle({ org }: { org: Organization }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");

  const isSuspended = Boolean(org.suspendedAt);

  async function suspend() {
    if (reason.trim().length < 3) { toast.error("اذكر سبب التعليق"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error?.message ?? "تعذّر التعليق"); return; }
      toast.success("تم تعليق الحساب");
      setShowForm(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function unsuspend() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/suspend`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error?.message ?? "تعذّر الرفع"); return; }
      toast.success("تم رفع التعليق");
      router.refresh();
    } finally { setBusy(false); }
  }

  if (isSuspended) {
    return (
      <div className="panel border-red-800/40 p-6">
        <h2 className="mb-1 font-semibold text-red-400">الحساب معلّق حالياً</h2>
        <p className="mb-4 text-sm text-ink-muted">السبب: {org.suspensionReason}</p>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void unsuspend()}>
          {busy ? "…" : "رفع التعليق ✓"}
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="panel border-amber-800/40 p-6">
        <h2 className="mb-3 font-semibold text-amber-300">تعليق الحساب</h2>
        <textarea
          rows={3}
          className="field-input mb-3"
          placeholder="سبب التعليق (يصل للمنشأة)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <button type="button" className="btn-danger" disabled={busy} onClick={() => void suspend()}>
            {busy ? "…" : "تأكيد التعليق"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
            تراجع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <h2 className="mb-1 font-semibold">تعليق الحساب</h2>
      <p className="mb-4 text-sm text-ink-muted">
        يمنع الدخول فوراً دون فقدان البيانات. يمكن رفعه في أي وقت.
      </p>
      <button type="button" className="btn-danger" onClick={() => setShowForm(true)}>
        تعليق الحساب
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export function OrgDeleteZone({ org, placementCount }: { org: Organization; placementCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  const canDelete = placementCount === 0;

  async function del() {
    if (confirm !== org.name) { toast.error("اسم المنشأة غير مطابق"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error?.message ?? "تعذّر الحذف"); return; }
      toast.success("تم حذف المنشأة نهائياً");
      router.push("/admin/orgs");
    } finally { setBusy(false); }
  }

  return (
    <div className="panel border-red-900/60 p-6">
      <h2 className="mb-1 font-semibold text-red-400">حذف نهائي</h2>
      {!canDelete ? (
        <p className="text-sm text-ink-muted">
          لا يمكن الحذف — لهذه المنشأة <strong>{placementCount}</strong> سجل إجراءات. علّق الحساب بدلاً من ذلك.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            سيُحذف كل شيء بشكل لا رجعة فيه. اكتب اسم المنشأة للتأكيد:
            <span className="mx-1 font-mono font-bold text-red-300">{org.name}</span>
          </p>
          <input
            className="field-input mb-3"
            placeholder="اكتب اسم المنشأة بالضبط…"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            className="btn-danger"
            disabled={busy || confirm !== org.name}
            onClick={() => void del()}
          >
            {busy ? "…" : "حذف نهائي"}
          </button>
        </>
      )}
    </div>
  );
}
