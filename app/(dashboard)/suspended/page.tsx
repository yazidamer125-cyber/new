import { requirePageContext } from "@/lib/auth/page-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const ctx = await requirePageContext();
  if (!ctx.org?.suspendedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="panel max-w-md p-8">
        <p className="mb-2 text-4xl">🔒</p>
        <h1 className="mb-2 text-xl font-bold text-red-400">حسابكم معلّق</h1>
        <p className="mb-4 text-sm text-ink-muted">
          تم تعليق حساب منشأتكم من قِبَل إدارة المنصة. يُرجى التواصل معنا لمزيد من التفاصيل.
        </p>
        {ctx.org.suspensionReason && (
          <p className="rounded border border-red-800/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            السبب: {ctx.org.suspensionReason}
          </p>
        )}
      </div>
    </div>
  );
}
