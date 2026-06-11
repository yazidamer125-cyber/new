import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
      <h1 className="mb-2 text-2xl font-bold">تسجيل الدخول</h1>
      <p className="mb-8 text-sm text-ink-muted">للمنشآت الأعضاء في المنصة فقط.</p>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
