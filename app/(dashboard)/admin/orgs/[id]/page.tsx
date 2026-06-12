import Link from "next/link";
import { and, count, eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import {
  organizations,
  workers,
  jobOrders,
  proposals,
  placements,
  users,
} from "@/lib/db/schema";
import { PageHeader, Badge, VERIFICATION_BADGE } from "@/components/ui";
import { SignedFileLink } from "@/components/files/SignedFile";
import { OrgReviewActions } from "@/components/admin/OrgReviewActions";
import { OrgEditForm, OrgSuspendToggle, OrgDeleteZone } from "@/components/admin/OrgManage";

export const dynamic = "force-dynamic";

const ORG_TYPE_LABEL: Record<string, string> = {
  source_agency: "وكالة توريد",
  recruitment_office: "مكتب استقدام",
};

export default async function AdminOrgDetailPage({ params }: { params: { id: string } }) {
  await requireAdminPage();

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, params.id),
  });
  if (!org) notFound();

  const [workerCount, orderCount, proposalCount, placementCount, userCount] = await Promise.all([
    db.select({ n: count() }).from(workers).where(eq(workers.agencyId, org.id)).then(([r]) => r.n),
    db.select({ n: count() }).from(jobOrders).where(eq(jobOrders.officeId, org.id)).then(([r]) => r.n),
    db
      .select({ n: count() })
      .from(proposals)
      .where(or(eq(proposals.agencyId, org.id)))
      .then(([r]) => r.n),
    db
      .select({ n: count() })
      .from(placements)
      .where(or(eq(placements.agencyId, org.id), eq(placements.officeId, org.id)))
      .then(([r]) => r.n),
    db.select({ n: count() }).from(users).where(eq(users.orgId, org.id)).then(([r]) => r.n),
  ]);

  const isAgency = org.type === "source_agency";
  const isSuspended = Boolean(org.suspendedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/admin/orgs" className="mt-1 text-sm text-ink-muted hover:text-ink">
          ← المنشآت
        </Link>
      </div>

      <PageHeader
        title={org.name}
        subtitle={`${ORG_TYPE_LABEL[org.type]} · ${org.country}${org.city ? ` · ${org.city}` : ""}`}
      />

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <Badge tone={VERIFICATION_BADGE[org.verificationStatus].tone}>
          {VERIFICATION_BADGE[org.verificationStatus].label}
        </Badge>
        {isSuspended && <Badge tone="red">معلّق</Badge>}
        {org.licenseDocKey && (
          <SignedFileLink objectKey={org.licenseDocKey} name={`license-${org.id}`}>
            <span className="text-xs text-accent underline">فتح ملف الرخصة ↗</span>
          </SignedFileLink>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: "المستخدمون", value: userCount },
          { label: isAgency ? "الكوادر" : "أوامر التوظيف", value: isAgency ? workerCount : orderCount },
          { label: "العروض", value: proposalCount },
          { label: "الإجراءات", value: placementCount },
          { label: "رخصة", value: org.licenseNumber ?? "—" },
        ].map((s) => (
          <div key={s.label} className="panel p-4 text-center">
            <p className="text-2xl font-bold text-accent">{s.value}</p>
            <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Verify/reject if pending */}
      {org.verificationStatus === "pending" && !isSuspended && (
        <div className="panel p-5">
          <h2 className="mb-3 font-semibold">مراجعة التوثيق</h2>
          <OrgReviewActions orgId={org.id} hasLicense={Boolean(org.licenseDocKey)} />
        </div>
      )}

      {/* Edit form */}
      <OrgEditForm org={org} />

      {/* Suspend / unsuspend */}
      <OrgSuspendToggle org={org} />

      {/* Danger zone: delete */}
      <OrgDeleteZone org={org} placementCount={placementCount} />
    </div>
  );
}
