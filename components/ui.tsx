import type { ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-navy-800 text-ink-muted",
  gold: "bg-accent/15 text-accent",
  green: "bg-emerald-500/15 text-emerald-300",
  red: "bg-red-500/15 text-red-300",
  blue: "bg-sky-500/15 text-sky-300",
  amber: "bg-amber-500/15 text-amber-300",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel p-5", className)}>{children}</div>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-2xl text-accent">◎</div>
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-md text-sm text-ink-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-navy-800", className)} />;
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}
    </label>
  );
}

export const VERIFICATION_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  verified: { label: "موثّق", tone: "green" },
  pending: { label: "قيد المراجعة", tone: "amber" },
  rejected: { label: "مرفوض", tone: "red" },
};

export const POSITION_LABEL: Record<string, string> = {
  housemaid: "عاملة منزلية",
  driver: "سائق",
  cook: "طبّاخ/ة",
  caregiver: "مقدّم/ة رعاية",
  other: "أخرى",
};

export const WORKER_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "مسودة", tone: "neutral" },
  available: { label: "متاح", tone: "green" },
  proposed: { label: "مُرشّح", tone: "blue" },
  reserved: { label: "محجوز", tone: "amber" },
  processing: { label: "قيد الإجراءات", tone: "amber" },
  deployed: { label: "تم السفر", tone: "gold" },
  inactive: { label: "غير نشط", tone: "neutral" },
};

export const PROPOSAL_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "بانتظار الرد", tone: "amber" },
  shortlisted: { label: "قائمة مختصرة", tone: "blue" },
  accepted: { label: "مقبول", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
  withdrawn: { label: "مسحوب", tone: "neutral" },
};

export const STAGE_LABEL: Record<string, string> = {
  contract: "العقد",
  visa: "التأشيرة",
  medical: "الفحص الطبي",
  ticketing: "الحجوزات",
  okb: "OKB",
  traveled: "غادر",
  arrived: "وصل",
  cancelled: "ملغي",
};

export const JOB_ORDER_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "مفتوح", tone: "green" },
  in_review: { label: "قيد المراجعة", tone: "amber" },
  fulfilled: { label: "مكتمل", tone: "gold" },
  cancelled: { label: "ملغي", tone: "neutral" },
  expired: { label: "منتهي", tone: "red" },
};

export const OKB_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "OKB: جديد", tone: "neutral" },
  submitted: { label: "OKB: مُرسل", tone: "blue" },
  approved: { label: "OKB: معتمد", tone: "green" },
  rejected: { label: "OKB: مرفوض", tone: "red" },
};
