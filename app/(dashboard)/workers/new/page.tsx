import { redirect } from "next/navigation";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { PageHeader } from "@/components/ui";
import { WorkerForm } from "@/components/workers/WorkerForm";

export const dynamic = "force-dynamic";

export default async function NewWorkerPage() {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "source_agency") redirect("/dashboard");

  return (
    <div>
      <PageHeader title="إضافة كادر جديد" subtitle="يُحفظ الملف كمسودة تلقائيًا — التفعيل يتطلب إقرار موافقة موقّعًا." />
      <WorkerForm initial={{}} />
    </div>
  );
}
