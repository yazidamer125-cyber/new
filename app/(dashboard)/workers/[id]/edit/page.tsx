import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { workers } from "@/lib/db/schema";
import { PageHeader, Badge, WORKER_STATUS_BADGE } from "@/components/ui";
import { WorkerForm } from "@/components/workers/WorkerForm";

export const dynamic = "force-dynamic";

export default async function EditWorkerPage({ params }: { params: { id: string } }) {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "source_agency") redirect("/dashboard");

  // Owner-scoped query: editing is only ever possible on own workers.
  const worker = await db.query.workers.findFirst({
    where: and(eq(workers.id, params.id), eq(workers.agencyId, ctx.org.id)),
  });
  if (!worker) notFound();

  const badge = WORKER_STATUS_BADGE[worker.status];
  return (
    <div>
      <PageHeader
        title={`تحرير: ${worker.fullName}`}
        subtitle="التعديلات تُحفظ على نفس الملف."
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />
      <WorkerForm
        initial={{
          id: worker.id,
          fullName: worker.fullName,
          dob: worker.dob,
          nationality: worker.nationality,
          passportNo: worker.passportNo,
          passportExpiry: worker.passportExpiry,
          position: worker.position,
          experienceYears: worker.experienceYears,
          languages: worker.languages,
          skills: worker.skills,
          salaryExpectation: worker.salaryExpectation,
          photoKey: worker.photoKey,
          videoKey: worker.videoKey,
          status: worker.status,
          hasConsent: Boolean(worker.consentId),
        }}
      />
    </div>
  );
}
