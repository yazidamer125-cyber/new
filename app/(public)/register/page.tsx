import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "إنشاء حساب بدعوة", robots: { index: false } };

export default function RegisterPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-16">
      <h1 className="mb-2 text-2xl font-bold">إنشاء حساب منشأة</h1>
      <p className="mb-8 text-sm text-ink-muted">
        التسجيل بدعوة فقط. لا تملك دعوة؟{" "}
        <Link href="/request-invite" className="text-accent hover:underline">
          اطلبها من هنا
        </Link>
        .
      </p>
      <RegisterForm token={token} />
    </div>
  );
}
