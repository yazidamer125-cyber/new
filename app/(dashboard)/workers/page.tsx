import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { workers } from "@/lib/db/schema";
import { PageHeader, EmptyState } from "@/components/ui";
import { WorkersTable } from "@/components/workers/WorkersTable";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "source_agency") redirect("/dashboard");

  const rows = await db
    .select()
    .from(workers)
    .where(eq(workers.agencyId, ctx.org.id))
    .orderBy(desc(workers.updatedAt));

  return (
    <div>
      <PageHeader
        title="الكوادر"
        subtitle="ملفات كوادر وكالتك — لا يطّلع عليها أي طرف آخر إلا عبر عرض تقدمه بنفسك."
        action={
          <Link href="/workers/new" className="btn-primary">
            + إضافة كادر
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد ملفات بعد"
          hint="ابدأ بإضافة أول ملف: البيانات الشخصية ثم المهارات ثم إقرار الموافقة الموقّع."
          action={
            <Link href="/workers/new" className="btn-primary">
              إضافة أول كادر
            </Link>
          }
        />
      ) : (
        <WorkersTable
          rows={rows.map((w) => ({
            id: w.id,
            fullName: w.fullName,
            nationality: w.nationality,
            position: w.position,
            status: w.status,
            hasConsent: Boolean(w.consentId),
            photoKey: w.photoKey,
            experienceYears: w.experienceYears,
          }))}
        />
      )}
      {/* TODO: bulk import (CSV/XLSX) — deferred to a later iteration */}
    </div>
  );
}
