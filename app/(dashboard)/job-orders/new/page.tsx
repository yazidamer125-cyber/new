import { redirect } from "next/navigation";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { PageHeader } from "@/components/ui";
import { JobOrderForm } from "@/components/job-orders/JobOrderForm";

export const dynamic = "force-dynamic";

export default async function NewJobOrderPage() {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "recruitment_office") redirect("/job-orders");

  return (
    <div>
      <PageHeader title="أمر توظيف جديد" subtitle="يظهر للوكالات الموثّقة دون كشف اسم مكتبك حتى مرحلة القائمة المختصرة." />
      <JobOrderForm />
    </div>
  );
}
