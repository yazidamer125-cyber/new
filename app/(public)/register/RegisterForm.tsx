"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Field } from "@/components/ui";

const schema = z.object({
  token: z.string().min(10, "رمز الدعوة مطلوب"),
  orgName: z.string().min(2, "اسم المنشأة مطلوب"),
  country: z.string().min(2, "الدولة مطلوبة"),
  city: z.string().optional(),
  licenseNumber: z.string().optional(),
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(10, "10 أحرف على الأقل"),
});

type Values = z.infer<typeof schema>;

export function RegisterForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { token } });

  async function onSubmit(values: Values) {
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "تعذّر إنشاء الحساب");
        return;
      }
      // Sign in (register endpoint creates the account server-side).
      await authClient.signIn.email({ email: values.email, password: values.password });
      toast.success("تم إنشاء الحساب — أكمل خطوات التوثيق");
      router.push("/onboarding");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-5 p-6">
      <Field label="رمز الدعوة" error={errors.token?.message} hint="وصلك ضمن رابط الدعوة">
        <input dir="ltr" className="field-input font-mono text-xs" {...register("token")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم المنشأة" error={errors.orgName?.message}>
          <input className="field-input" {...register("orgName")} />
        </Field>
        <Field label="رقم الترخيص (اختياري الآن)" error={errors.licenseNumber?.message}>
          <input dir="ltr" className="field-input" {...register("licenseNumber")} />
        </Field>
        <Field label="الدولة" error={errors.country?.message}>
          <input className="field-input" {...register("country")} />
        </Field>
        <Field label="المدينة" error={errors.city?.message}>
          <input className="field-input" {...register("city")} />
        </Field>
      </div>
      <hr className="border-navy-800" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسمك الكامل" error={errors.name?.message}>
          <input className="field-input" {...register("name")} />
        </Field>
        <Field label="البريد الإلكتروني" error={errors.email?.message} hint="نفس بريد الدعوة">
          <input dir="ltr" type="email" className="field-input" {...register("email")} />
        </Field>
      </div>
      <Field label="كلمة المرور" error={errors.password?.message}>
        <input dir="ltr" type="password" autoComplete="new-password" className="field-input" {...register("password")} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
      </button>
    </form>
  );
}
