"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field, Badge, POSITION_LABEL, cn } from "@/components/ui";
import { FileUploader } from "@/components/files/FileUploader";
import { SignedImage } from "@/components/files/SignedFile";

const formSchema = z.object({
  fullName: z.string().min(2, "الاسم الكامل مطلوب"),
  dob: z.string().optional(),
  nationality: z.string().min(2, "الجنسية مطلوبة"),
  passportNo: z.string().optional(),
  passportExpiry: z.string().optional(),
  position: z.enum(["housemaid", "driver", "cook", "caregiver", "other"]),
  experienceYears: z.coerce.number().int().min(0).max(50),
  languagesText: z.string().optional(),
  skillsText: z.string().optional(),
  salaryExpectation: z.coerce.number().min(0).optional().or(z.literal("")),
});

type Values = z.infer<typeof formSchema>;

export type WorkerFormInitial = {
  id?: string;
  fullName?: string;
  dob?: string | null;
  nationality?: string;
  passportNo?: string | null;
  passportExpiry?: string | null;
  position?: string;
  experienceYears?: number;
  languages?: string[];
  skills?: string[];
  salaryExpectation?: number | null;
  photoKey?: string | null;
  videoKey?: string | null;
  status?: string;
  hasConsent?: boolean;
};

const STEPS = ["البيانات والجواز", "المهارات والخبرة", "الصورة والفيديو", "الموافقة والتفعيل"] as const;
const STEP_FIELDS: (keyof Values)[][] = [
  ["fullName", "dob", "nationality", "passportNo", "passportExpiry"],
  ["position", "experienceYears", "languagesText", "skillsText", "salaryExpectation"],
  [],
  [],
];

function toPayload(v: Values, media: { photoKey: string | null; videoKey: string | null }) {
  return {
    fullName: v.fullName,
    dob: v.dob || null,
    nationality: v.nationality,
    passportNo: v.passportNo || null,
    passportExpiry: v.passportExpiry || null,
    position: v.position,
    experienceYears: v.experienceYears,
    languages: (v.languagesText ?? "").split("،").flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean),
    skills: (v.skillsText ?? "").split("،").flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean),
    salaryExpectation: v.salaryExpectation === "" || v.salaryExpectation == null ? null : v.salaryExpectation,
    photoKey: media.photoKey,
    videoKey: media.videoKey,
  };
}

/**
 * Multi-step worker editor with draft autosave. Step 4 enforces rule #2 in
 * the UI: activation (leaving 'draft') is impossible before a signed consent
 * PDF + date are on file — and the API/DB enforce the same independently.
 */
export function WorkerForm({ initial }: { initial: WorkerFormInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workerId, setWorkerId] = useState<string | undefined>(initial.id);
  const [photoKey, setPhotoKey] = useState<string | null>(initial.photoKey ?? null);
  const [videoKey, setVideoKey] = useState<string | null>(initial.videoKey ?? null);
  const [hasConsent, setHasConsent] = useState(Boolean(initial.hasConsent));
  const [consentDocKey, setConsentDocKey] = useState<string | null>(null);
  const [signedDate, setSignedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const isDraft = (initial.status ?? "draft") === "draft";
  const mediaRef = useRef({ photoKey, videoKey });
  mediaRef.current = { photoKey, videoKey };

  const {
    register,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: initial.fullName ?? "",
      dob: initial.dob ?? "",
      nationality: initial.nationality ?? "",
      passportNo: initial.passportNo ?? "",
      passportExpiry: initial.passportExpiry ?? "",
      position: (initial.position as Values["position"]) ?? "housemaid",
      experienceYears: initial.experienceYears ?? 0,
      languagesText: (initial.languages ?? []).join("، "),
      skillsText: (initial.skills ?? []).join("، "),
      salaryExpectation: initial.salaryExpectation ?? ("" as const),
    },
  });

  const save = useCallback(
    async (silent = false): Promise<string | null> => {
      setSaving(true);
      try {
        const payload = toPayload(getValues(), mediaRef.current);
        const res = await fetch(workerId ? `/api/workers/${workerId}` : "/api/workers", {
          method: workerId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!silent) toast.error(data?.error?.message ?? "تعذّر الحفظ");
          return null;
        }
        const id = data.worker.id as string;
        setWorkerId(id);
        if (!silent) toast.success("تم الحفظ");
        return id;
      } finally {
        setSaving(false);
      }
    },
    [getValues, workerId],
  );

  // Autosave draft every 30s once a draft row exists.
  useEffect(() => {
    if (!workerId) return;
    const t = setInterval(() => void save(true), 30_000);
    return () => clearInterval(t);
  }, [workerId, save]);

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (!valid) return;
    const id = await save(true);
    if (!id) {
      toast.error("تعذّر حفظ المسودة");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function activate() {
    if (!workerId) return;
    setActivating(true);
    try {
      if (!hasConsent) {
        if (!consentDocKey || !signedDate) {
          toast.error("ارفع إقرار الموافقة الموقّع وحدد تاريخ التوقيع");
          return;
        }
        const consentRes = await fetch(`/api/workers/${workerId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docKey: consentDocKey, signedDate }),
        });
        if (!consentRes.ok) {
          const data = await consentRes.json();
          toast.error(data?.error?.message ?? "تعذّر حفظ الموافقة");
          return;
        }
        setHasConsent(true);
      }
      if (isDraft) {
        const statusRes = await fetch(`/api/workers/${workerId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "available" }),
        });
        if (!statusRes.ok) {
          const data = await statusRes.json();
          toast.error(data?.error?.message ?? "تعذّر التفعيل");
          return;
        }
      }
      toast.success("الملف مفعّل وجاهز للترشيح");
      router.push("/workers");
      router.refresh();
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs transition",
                i === step
                  ? "border-accent bg-accent/15 font-semibold text-accent"
                  : i < step
                    ? "border-emerald-700 text-emerald-300"
                    : "border-navy-700 text-ink-muted",
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="panel space-y-5 p-6">
        {step === 0 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="الاسم الكامل (كما في الجواز)" error={errors.fullName?.message}>
                <input className="field-input" {...register("fullName")} />
              </Field>
              <Field label="الجنسية" error={errors.nationality?.message}>
                <input className="field-input" {...register("nationality")} />
              </Field>
              <Field label="تاريخ الميلاد" error={errors.dob?.message}>
                <input dir="ltr" type="date" className="field-input" {...register("dob")} />
              </Field>
              <Field label="رقم الجواز" error={errors.passportNo?.message}>
                <input dir="ltr" className="field-input" {...register("passportNo")} />
              </Field>
              <Field label="انتهاء الجواز" error={errors.passportExpiry?.message}>
                <input dir="ltr" type="date" className="field-input" {...register("passportExpiry")} />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="المهنة">
              <select className="field-input" {...register("position")}>
                {Object.entries(POSITION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="سنوات الخبرة" error={errors.experienceYears?.message}>
              <input dir="ltr" type="number" min={0} className="field-input" {...register("experienceYears")} />
            </Field>
            <Field label="اللغات (افصل بفاصلة)" hint="مثال: عربي، إنجليزي">
              <input className="field-input" {...register("languagesText")} />
            </Field>
            <Field label="المهارات (افصل بفاصلة)" hint="مثال: طبخ، عناية بالأطفال">
              <input className="field-input" {...register("skillsText")} />
            </Field>
            <Field label="الراتب المتوقع (USD)" error={errors.salaryExpectation?.message}>
              <input dir="ltr" type="number" min={0} className="field-input" {...register("salaryExpectation")} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="field-label">الصورة الشخصية</p>
              <SignedImage objectKey={photoKey} alt="" className="h-36 w-36 rounded-xl object-cover" />
              <FileUploader
                kind="worker_photo"
                workerId={workerId}
                accept="image/jpeg,image/png,image/webp"
                label="رفع صورة"
                onUploaded={(key) => {
                  setPhotoKey(key);
                  void save(true);
                }}
              />
            </div>
            <div className="space-y-3">
              <p className="field-label">فيديو تعريفي (اختياري)</p>
              <p className="text-xs text-ink-muted">{videoKey ? "تم رفع فيديو ✓" : "لم يُرفع فيديو بعد"}</p>
              <FileUploader
                kind="worker_video"
                workerId={workerId}
                accept="video/mp4,video/webm"
                label="رفع فيديو"
                onUploaded={(key) => {
                  setVideoKey(key);
                  void save(true);
                }}
              />
            </div>
            {!workerId && <p className="text-xs text-amber-300 sm:col-span-2">احفظ البيانات أولًا (الخطوة السابقة) لتفعيل الرفع.</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed">
              <p className="font-semibold text-accent">إقرار الموافقة شرط إلزامي</p>
              <p className="mt-1 text-ink-muted">
                لا يمكن مشاركة أي ملف في عرض قبل رفع إقرار موافقة موقّع من صاحب الملف يجيز مشاركة بياناته مع
                مكاتب الاستقدام المرخّصة (نطاق: B2B فقط). يُحفظ الإقرار مع تاريخ التوقيع في سجل التدقيق.
              </p>
            </div>
            {hasConsent ? (
              <Badge tone="green">إقرار الموافقة موقّع ومحفوظ ✓</Badge>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="field-label">ملف الإقرار الموقّع (PDF)</p>
                  <FileUploader
                    kind="consent"
                    workerId={workerId}
                    accept="application/pdf"
                    label="رفع إقرار الموافقة"
                    onUploaded={(key) => setConsentDocKey(key)}
                  />
                </div>
                <Field label="تاريخ التوقيع">
                  <input
                    dir="ltr"
                    type="date"
                    className="field-input"
                    value={signedDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setSignedDate(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <button
              type="button"
              className="btn-primary w-full"
              disabled={activating || !workerId || (!hasConsent && (!consentDocKey || !signedDate))}
              onClick={activate}
            >
              {activating ? "جارٍ التفعيل…" : isDraft ? "تفعيل الملف (متاح للترشيح)" : "حفظ الموافقة"}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-navy-800 pt-4">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            السابق
          </button>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => void save()}>
              {saving ? "يحفظ…" : "حفظ المسودة"}
            </button>
            {step < STEPS.length - 1 && (
              <button type="button" className="btn-primary" onClick={() => void nextStep()}>
                التالي
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
