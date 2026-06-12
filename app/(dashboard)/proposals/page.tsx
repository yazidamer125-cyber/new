import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { proposals, jobOrders } from "@/lib/db/schema";
import { PageHeader, EmptyState, Badge, PROPOSAL_STATUS_BADGE, POSITION_LABEL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const ctx = await requireVerifiedPage();
  const isAgency = ctx.org.type === "source_agency";

  let rows;
  if (isAgency) {
    rows = await db.query.proposals.findMany({
      where: eq(proposals.agencyId, ctx.org.id),
      orderBy: desc(proposals.createdAt),
      with: { jobOrder: { with: { office: { columns: { name: true, country: true } } } }, workers: true },
    });
  } else {
    const own = await db.select({ id: jobOrders.id }).from(jobOrders).where(eq(jobOrders.officeId, ctx.org.id));
    rows =
      own.length === 0
        ? []
        : await db.query.proposals.findMany({
            where: inArray(
              proposals.jobOrderId,
              own.map((j) => j.id),
            ),
            orderBy: desc(proposals.createdAt),
            with: {
              jobOrder: { with: { office: { columns: { name: true, country: true } } } },
              workers: true,
              agency: { columns: { name: true, country: true } },
            },
          });
  }

  return (
    <div>
      <PageHeader
        title={isAgency ? "عروضي المرسلة" : "العروض الواردة"}
        subtitle={
          isAgency
            ? "هوية المكتب تُعرض بعد إدراجك في القائمة المختصرة."
            : "راجع تفاصيل كل عرض من صفحة أمر التوظيف."
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title={isAgency ? "لم ترسل أي عروض بعد" : "لا عروض واردة بعد"}
          hint={isAgency ? "تصفح لوحة الطلب وقدّم أول عرض." : "انشر أمر توظيف ليصلك أول عرض."}
          action={
            <Link href="/job-orders" className="btn-primary">
              {isAgency ? "لوحة الطلب" : "أوامر التوظيف"}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const badge = PROPOSAL_STATUS_BADGE[p.status];
            const revealOffice = isAgency && ["shortlisted", "accepted"].includes(p.status);
            const officeLabel = revealOffice
              ? `${p.jobOrder.office.name} — ${p.jobOrder.office.country}`
              : `مكتب موثّق — ${p.jobOrder.office.country}`;
            return (
              <Link
                key={p.id}
                href={isAgency ? `/proposals/${p.id}` : `/job-orders/${p.jobOrderId}`}
                className="panel block p-4 transition hover:border-accent/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {POSITION_LABEL[p.jobOrder.position]} × {p.jobOrder.quantity}
                      <span className="mr-2 text-xs font-normal text-ink-muted">
                        {isAgency ? officeLabel : `من ${(p as { agency?: { name: string } }).agency?.name ?? "وكالة"}`}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{p.workers.length} مرشح · {p.createdAt.toLocaleDateString("ar")}</p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
