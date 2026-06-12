import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/helpers";
import { Skeleton } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Validated (DB-backed) check, unlike the cookie sniff in middleware: a
  // stale cookie falls through to the form instead of redirect-looping.
  if (await getSessionContext()) redirect("/dashboard");
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
