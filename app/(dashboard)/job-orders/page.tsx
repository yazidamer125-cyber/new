import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { jobOrders, organizations, workers, proposals } from "@/lib/db/schema";
import { PageHeader, EmptyState, Badge, JOB_ORDER_STATUS_BADGE, POSITION_LABEL } from "@/components/ui";
import { DemandBoard, type DemandCard } from "@/components/job-orders/DemandBoard";

export const dynamic = "force-dynamic";

export default async function JobOrdersPage() {
  const ctx = await requireVerifiedPage();

  // ---------- Recruitment office: own job orders ----------
  if (ctx.org.type === "recruitment_office") {
    const rows = await db
      .select()
      .from(jobOrders)
      .where(eq(jobOrders.officeId, ctx.org.id))
      .orderBy(desc(jobOrders.createdAt));

    return (
      <div>
        <PageHeader
          title="أوامر التوظيف"
          subtitle="انشر احتياجك وستصلك عروض من وكالات توريد موثّقة."
          action={
            <Link href="/job-orders/new" className="btn-primary">
              + أمر توظيف جديد
            </Link>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="لا توجد أوامر توظيف بعد"
            hint="أنشئ أول أمر: المهنة، الجنسية المفضلة، العدد، الراتب وتاريخ السفر المستهدف."
            action={
              <Link href="/job-orders/new" className="btn-primary">
                إنشاء أمر توظيف
              </Link>
            }
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-right text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">المهنة</th>
                  <th className="px-4 py-3 font-medium">الجنسية</th>
                  <th className="px-4 py-3 font-medium">العدد</th>
                  <th className="px-4 py-3 font-medium">الراتب</th>
                  <th className="px-4 py-3 font-medium">السفر المستهدف</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const badge = JOB_ORDER_STATUS_BADGE[o.status];
                  return (
                    <tr key={o.id} className="border-b border-navy-800/60 last:border-0 hover:bg-navy-800/40">
                      <td className="px-4 py-3 font-medium">{POSITION_LABEL[o.position]}</td>
                      <td className="px-4 py-3 text-ink-muted">{o.nationalityPref ?? "أي جنسية"}</td>
                      <td className="px-4 py-3 text-ink-muted">{o.quantity}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {o.salaryOffer ? `${o.salaryOffer} ${o.currency}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{o.targetTravelDate ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <Link href={`/job-orders/${o.id}`} className="text-accent hover:underline">
                          العروض ←
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

  // ---------- Source agency: the demand board ----------
  const open = await db
    .select({
      id: jobOrders.id,
      position: jobOrders.position,
      nationalityPref: jobOrders.nationalityPref,
      quantity: jobOrders.quantity,
      salaryOffer: jobOrders.salaryOffer,
      currency: jobOrders.currency,
      contractMonths: jobOrders.contractMonths,
      targetTravelDate: jobOrders.targetTravelDate,
      specialRequirements: jobOrders.specialRequirements,
      createdAt: jobOrders.createdAt,
      officeCountry: organizations.country, // office NAME stays hidden pre-shortlist
    })
    .from(jobOrders)
    .innerJoin(organizations, eq(jobOrders.officeId, organizations.id))
    .where(and(eq(jobOrders.status, "open"), eq(organizations.verificationStatus, "verified")))
    .orderBy(desc(jobOrders.createdAt));

  const myProposals = await db
    .select({ jobOrderId: proposals.jobOrderId })
    .from(proposals)
    .where(eq(proposals.agencyId, ctx.org.id));
  const proposedSet = new Set(myProposals.map((p) => p.jobOrderId));

  const myAvailable = await db
    .select({
      id: workers.id,
      fullName: workers.fullName,
      position: workers.position,
      nationality: workers.nationality,
      status: workers.status,
    })
    .from(workers)
    .where(and(eq(workers.agencyId, ctx.org.id), eq(workers.status, "available")));

  const cards: DemandCard[] = open.map((o) => ({
    id: o.id,
    position: o.position,
    nationalityPref: o.nationalityPref,
    quantity: o.quantity,
    salaryOffer: o.salaryOffer,
    currency: o.currency,
    contractMonths: o.contractMonths,
    targetTravelDate: o.targetTravelDate,
    specialRequirements: o.specialRequirements,
    officeCountry: o.officeCountry,
    alreadyProposed: proposedSet.has(o.id),
  }));

  return (
    <div>
      <PageHeader
        title="لوحة الطلب"
        subtitle="أوامر توظيف مفتوحة من مكاتب موثّقة. هوية المكتب تُكشف بعد إدراج عرضك في القائمة المختصرة."
      />
      {cards.length === 0 ? (
        <EmptyState title="لا توجد أوامر مفتوحة حاليًا" hint="ستصلك التنبيهات فور نشر أوامر جديدة." />
      ) : (
        <DemandBoard cards={cards} availableWorkers={myAvailable} />
      )}
    </div>
  );
}
