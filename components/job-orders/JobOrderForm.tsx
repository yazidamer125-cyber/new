"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field, POSITION_LABEL } from "@/components/ui";

const schema = z.object({
  position: z.enum(["housemaid", "driver", "cook", "caregiver", "other"]),
  nationalityPref: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "1 على الأقل").max(500),
  salaryOffer: z.coerce.number().min(0).optional().or(z.literal("")),
  currency: z.string().min(3).max(5),
  contractMonths: z.coerce.number().int().min(3).max(60),
  targetTravelDate: z.string().optional(),
  specialRequirements: z.string().max(2000).optional(),
  expiresInDays: z.coerce.number().int().min(7).max(180),
});

type Values = z.infer<typeof schema>;

export function JobOrderForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { position: "housemaid", quantity: 1, currency: "JOD", contractMonths: 24, expiresInDays: 60 },
  });

  async function onSubmit(values: Values) {
    setBusy(true);
    try {
      const res = await fetch("/api/job-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          salaryOffer: values.salaryOffer === "" ? null : values.salaryOffer,
          nationalityPref: values.nationalityPref || null,
          targetTravelDate: values.targetTravelDate || null,
          specialRequirements: values.specialRequirements || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر نشر الأمر");
        return;
      }
      toast.success("نُشر أمر التوظيف");
      router.push("/job-orders");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel mx-auto max-w-2xl space-y-5 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="المهنة المطلوبة">
          <select className="field-input" {...register("position")}>
            {Object.entries(POSITION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الجنسية المفضلة" hint="اتركه فارغًا لقبول أي جنسية">
          <input className="field-input" placeholder="مثال: إثيوبية" {...register("nationalityPref")} />
        </Field>
        <Field label="العدد المطلوب" error={errors.quantity?.message}>
          <input dir="ltr" type="number" min={1} className="field-input" {...register("quantity")} />
        </Field>
        <Field label="مدة العقد (أشهر)" error={errors.contractMonths?.message}>
          <input dir="ltr" type="number" min={3} className="field-input" {...register("contractMonths")} />
        </Field>
        <Field label="الراتب المعروض" error={errors.salaryOffer?.message}>
          <input dir="ltr" type="number" min={0} className="field-input" {...register("salaryOffer")} />
        </Field>
        <Field label="العملة">
          <select className="field-input" {...register("currency")}>
            {["JOD", "USD", "SAR", "AED", "QAR", "KWD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="تاريخ السفر المستهدف">
          <input dir="ltr" type="date" className="field-input" {...register("targetTravelDate")} />
        </Field>
        <Field label="صلاحية الأمر (أيام)" error={errors.expiresInDays?.message}>
          <input dir="ltr" type="number" min={7} max={180} className="field-input" {...register("expiresInDays")} />
        </Field>
      </div>
      <Field label="متطلبات خاصة" hint="خبرة سابقة في الخليج، لغة معينة…">
        <textarea rows={3} className="field-input" {...register("specialRequirements")} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "جارٍ النشر…" : "نشر أمر التوظيف"}
      </button>
    </form>
  );
}
