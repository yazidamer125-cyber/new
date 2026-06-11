"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, POSITION_LABEL, WORKER_STATUS_BADGE } from "@/components/ui";
import { SignedImage } from "@/components/files/SignedFile";

export type WorkerRow = {
  id: string;
  fullName: string;
  nationality: string;
  position: string;
  status: string;
  hasConsent: boolean;
  photoKey: string | null;
  experienceYears: number;
};

export function WorkersTable({ rows }: { rows: WorkerRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [position, setPosition] = useState("all");

  const filtered = useMemo(
    () =>
      rows.filter((w) => {
        if (status !== "all" && w.status !== status) return false;
        if (position !== "all" && w.position !== position) return false;
        if (q && !`${w.fullName} ${w.nationality}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q, status, position],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="field-input max-w-xs"
          placeholder="بحث بالاسم أو الجنسية…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(WORKER_STATUS_BADGE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className="field-input w-auto" value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="all">كل المهن</option>
          {Object.entries(POSITION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">{filtered.length} نتيجة</span>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800 text-right text-xs text-ink-muted">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">المهنة</th>
              <th className="px-4 py-3 font-medium">الجنسية</th>
              <th className="px-4 py-3 font-medium">الخبرة</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">الموافقة</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const badge = WORKER_STATUS_BADGE[w.status] ?? WORKER_STATUS_BADGE.draft;
              return (
                <tr key={w.id} className="border-b border-navy-800/60 last:border-0 hover:bg-navy-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <SignedImage objectKey={w.photoKey} alt="" className="h-9 w-9 rounded-full object-cover" />
                      <span className="font-medium">{w.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{POSITION_LABEL[w.position] ?? w.position}</td>
                  <td className="px-4 py-3 text-ink-muted">{w.nationality}</td>
                  <td className="px-4 py-3 text-ink-muted">{w.experienceYears} سنة</td>
                  <td className="px-4 py-3">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {w.hasConsent ? (
                      <Badge tone="green">موقّعة ✓</Badge>
                    ) : (
                      <Badge tone="red">ناقصة — مطلوبة للنشر</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link href={`/workers/${w.id}/edit`} className="text-accent hover:underline">
                      تحرير
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
