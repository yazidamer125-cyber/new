import { desc } from "drizzle-orm";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { invitations, inviteRequests } from "@/lib/db/schema";
import { PageHeader, Badge } from "@/components/ui";
import { InvitationForm } from "@/components/admin/InvitationForm";
import { InviteRequestActions } from "@/components/admin/InviteRequestActions";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  await requireAdminPage();

  const sent = await db.select().from(invitations).orderBy(desc(invitations.createdAt)).limit(50);
  const requests = await db.select().from(inviteRequests).orderBy(desc(inviteRequests.createdAt)).limit(50);
  const newRequests = requests.filter((r) => r.status === "new");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="الدعوات" subtitle="المنصة بالدعوة فقط — أنشئ دعوة وشارك الرابط مع المنشأة." />

      <div className="panel mb-8 p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-muted">إنشاء دعوة جديدة</h2>
        <InvitationForm />
      </div>

      <h2 className="mb-3 text-lg font-semibold">طلبات انضمام واردة ({newRequests.length})</h2>
      <div className="mb-8 space-y-3">
        {newRequests.length === 0 ? (
          <p className="text-sm text-ink-muted">لا طلبات جديدة.</p>
        ) : (
          newRequests.map((r) => (
            <div key={r.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">
                  {r.orgName}{" "}
                  <span className="text-xs font-normal text-ink-muted">
                    ({r.orgType === "source_agency" ? "وكالة توريد" : "مكتب استقدام"} · {r.country})
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-muted" dir="ltr">
                  {r.contactName} · {r.email}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
                {r.message ? <p className="mt-1 text-xs text-ink-muted">{r.message}</p> : null}
              </div>
              <InviteRequestActions requestId={r.id} email={r.email} orgType={r.orgType} />
            </div>
          ))
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">الدعوات الصادرة</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800 text-right text-xs text-ink-muted">
              <th className="px-4 py-3 font-medium">البريد</th>
              <th className="px-4 py-3 font-medium">النوع</th>
              <th className="px-4 py-3 font-medium">تنتهي</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {sent.map((inv) => {
              const expired = inv.expiresAt < new Date();
              return (
                <tr key={inv.id} className="border-b border-navy-800/60 last:border-0">
                  <td className="px-4 py-3" dir="ltr">
                    {inv.email}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {inv.orgType === "source_agency" ? "وكالة" : "مكتب"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted" dir="ltr">
                    {inv.expiresAt.toLocaleDateString("ar")}
                  </td>
                  <td className="px-4 py-3">
                    {inv.usedAt ? (
                      <Badge tone="green">استُخدمت</Badge>
                    ) : expired ? (
                      <Badge tone="red">منتهية</Badge>
                    ) : (
                      <Badge tone="amber">بانتظار التسجيل</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
