import { count, desc, eq } from "drizzle-orm";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { organizations, workers, jobOrders, proposals, placements } from "@/lib/db/schema";
import { PageHeader, Card, EmptyState, Badge, VERIFICATION_BADGE } from "@/components/ui";
import { OrgReviewActions } from "@/components/admin/OrgReviewActions";
import { SignedFileLink } from "@/components/files/SignedFile";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();

  const [orgCount] = await db.select({ n: count() }).from(organizations);
  const [workerCount] = await db.select({ n: count() }).from(workers);
  const [orderCount] = await db.select({ n: count() }).from(jobOrders);
  const [proposalCount] = await db.select({ n: count() }).from(proposals);
  const [placementCount] = await db.select({ n: count() }).from(placements);

  const pending = await db
    .select()
    .from(organizations)
    .where(eq(organizations.verificationStatus, "pending"))
    .orderBy(desc(organizations.createdAt));

  const stats = [
    { label: "منشآت", value: orgCount.n },
    { label: "ملفات كوادر", value: workerCount.n },
    { label: "أوامر توظيف", value: orderCount.n },
    { label: "عروض", value: proposalCount.n },
    { label: "ملفات إجراءات", value: placementCount.n },
  ];

  return (
    <div>
      <PageHeader title="إدارة المنصة" subtitle="توثيق التراخيص ومؤشرات عامة." />

      <div className="mb-10 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-3xl font-bold text-accent">{s.value}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-semibold">منشآت بانتظار التوثيق ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState title="لا طلبات معلّقة" hint="كل المنشآت المسجلة تمت مراجعتها." />
      ) : (
        <div className="space-y-4">
          {pending.map((org) => (
            <div key={org.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {org.name}{" "}
                    <Badge tone={VERIFICATION_BADGE[org.verificationStatus].tone}>
                      {VERIFICATION_BADGE[org.verificationStatus].label}
                    </Badge>
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {org.type === "source_agency" ? "وكالة توريد" : "مكتب استقدام"} · {org.country}
                    {org.city ? ` · ${org.city}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted" dir="ltr">
                    رخصة: {org.licenseNumber ?? "—"}
                  </p>
                  <div className="mt-2">
                    {org.licenseDocKey ? (
                      <SignedFileLink objectKey={org.licenseDocKey} name={`license-${org.name}`}>
                        فتح ملف الرخصة ↗
                      </SignedFileLink>
                    ) : (
                      <span className="text-xs text-amber-300">لم تُرفع الرخصة بعد</span>
                    )}
                  </div>
                </div>
                <OrgReviewActions orgId={org.id} hasLicense={Boolean(org.licenseDocKey)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
