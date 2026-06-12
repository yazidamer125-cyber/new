"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Field } from "@/components/ui";

const schema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setBusy(true);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    setBusy(false);
    if (error) {
      toast.error("بيانات الدخول غير صحيحة");
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-5 p-6">
      <Field label="البريد الإلكتروني" error={errors.email?.message}>
        <input dir="ltr" type="email" autoComplete="email" className="field-input" {...register("email")} />
      </Field>
      <Field label="كلمة المرور" error={errors.password?.message}>
        <input dir="ltr" type="password" autoComplete="current-password" className="field-input" {...register("password")} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
