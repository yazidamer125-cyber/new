"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/ui";

const schema = z.object({
  orgName: z.string().min(2, "اسم المنشأة مطلوب"),
  orgType: z.enum(["source_agency", "recruitment_office"]),
  country: z.string().min(2, "الدولة مطلوبة"),
  contactName: z.string().min(2, "اسم جهة الاتصال مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().optional(),
  message: z.string().max(1000).optional(),
});

type Values = z.infer<typeof schema>;

export function RequestInviteForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { orgType: "recruitment_office" } });

  async function onSubmit(values: Values) {
    setBusy(true);
    try {
      const res = await fetch("/api/request-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error("تعذّر إرسال الطلب، حاول مجددًا");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-lg font-semibold text-accent">تم استلام طلبكم ✓</p>
        <p className="mt-2 text-sm text-ink-muted">سيتواصل معكم فريق وكيل برو عبر البريد الإلكتروني بعد المراجعة.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-5 p-6">
      <Field label="نوع المنشأة">
        <select className="field-input" {...register("orgType")}>
          <option value="recruitment_office">مكتب استقدام (الأردن / الخليج)</option>
          <option value="source_agency">وكالة توريد (دولة مصدر)</option>
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم المنشأة" error={errors.orgName?.message}>
          <input className="field-input" {...register("orgName")} />
        </Field>
        <Field label="الدولة" error={errors.country?.message}>
          <input className="field-input" {...register("country")} />
        </Field>
        <Field label="جهة الاتصال" error={errors.contactName?.message}>
          <input className="field-input" {...register("contactName")} />
        </Field>
        <Field label="رقم الهاتف" error={errors.phone?.message}>
          <input dir="ltr" className="field-input" {...register("phone")} />
        </Field>
      </div>
      <Field label="البريد الإلكتروني" error={errors.email?.message}>
        <input dir="ltr" type="email" className="field-input" {...register("email")} />
      </Field>
      <Field label="نبذة عن نشاطكم (اختياري)" error={errors.message?.message}>
        <textarea rows={3} className="field-input" {...register("message")} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "جارٍ الإرسال…" : "إرسال الطلب"}
      </button>
    </form>
  );
}
