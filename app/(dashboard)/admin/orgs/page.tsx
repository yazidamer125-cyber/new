import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PageHeader, Badge, VERIFICATION_BADGE } from "@/components/ui";

export const dynamic = "force-dynamic";

const ORG_TYPE_LABEL: Record<string, string> = {
  source_agency: "وكالة توريد",
  recruitment_office: "مكتب استقدام",
};

export default async function AdminOrgsPage() {
  await requireAdminPage();

  const orgs = await db.query.organizations.findMany({
    orderBy: desc(organizations.createdAt),
  });

  const total = orgs.length;
  const verified = orgs.filter((o) => o.verificationStatus === "verified" && !o.suspendedAt).length;
  const pending = orgs.filter((o) => o.verificationStatus === "pending").length;
  const suspended = orgs.filter((o) => o.suspendedAt).length;

  return (
    <div>
      <PageHeader title="إدارة المنشآت" subtitle="عرض وتعديل وتعليق وحذف جميع المنشآت المسجلة." />

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-navy-700 px-3 py-1">الكل: {total}</span>
        <span className="rounded-full border border-green-700/60 px-3 py-1 text-green-300">موثّق: {verified}</span>
        <span className="rounded-full border border-amber-700/60 px-3 py-1 text-amber-300">معلّق انتظار: {pending}</span>
        <span className="rounded-full border border-red-700/60 px-3 py-1 text-red-300">معلّق إداري: {suspended}</span>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-ink-muted">لا منشآت مسجلة بعد.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 bg-navy-800 text-right text-xs text-ink-muted">
                <th className="px-4 py-3">المنشأة</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الدولة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">تاريخ التسجيل</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const isSuspended = Boolean(org.suspendedAt);
                return (
                  <tr key={org.id} className="border-b border-navy-700/50 hover:bg-navy-800/40">
                    <td className="px-4 py-3 font-medium">
                      {org.name}
                      {isSuspended && <span className="mr-2"><Badge tone="red">معلّق</Badge></span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{ORG_TYPE_LABEL[org.type]}</td>
                    <td className="px-4 py-3 text-ink-muted">{org.country}</td>
                    <td className="px-4 py-3">
                      <Badge tone={VERIFICATION_BADGE[org.verificationStatus].tone}>
                        {VERIFICATION_BADGE[org.verificationStatus].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted" dir="ltr">
                      {org.createdAt.toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orgs/${org.id}`}
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        إدارة ←
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
