import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { jobOrders, proposals } from "@/lib/db/schema";
import { getViewableWorker, workerPublicView } from "@/lib/db/access";
import { PageHeader, Badge, EmptyState, JOB_ORDER_STATUS_BADGE, POSITION_LABEL, PROPOSAL_STATUS_BADGE } from "@/components/ui";
import { ProposalReview, type ProposalView } from "@/components/proposals/ProposalReview";

export const dynamic = "force-dynamic";

export default async function JobOrderDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "recruitment_office") redirect("/job-orders");

  const order = await db.query.jobOrders.findFirst({
    where: and(eq(jobOrders.id, params.id), eq(jobOrders.officeId, ctx.org.id)),
  });
  if (!order) notFound();

  const received = await db.query.proposals.findMany({
    where: eq(proposals.jobOrderId, order.id),
    orderBy: desc(proposals.createdAt),
    with: {
      agency: { columns: { id: true, name: true, country: true } },
      workers: true,
      threads: { columns: { id: true } },
    },
  });

  // Every worker rendered here is a cross-org read: resolve through
  // getViewableWorker so it is authorized AND audit-logged (rules #1, #4).
  const views: ProposalView[] = [];
  for (const p of received) {
    const workerCards = [];
    for (const pw of p.workers) {
      try {
        const { worker } = await getViewableWorker(ctx, pw.workerId);
        workerCards.push({ ...workerPublicView(worker), markStatus: pw.status });
      } catch {
        // Worker no longer visible (e.g. withdrawn) — skip silently.
      }
    }
    views.push({
      id: p.id,
      status: p.status,
      message: p.message,
      createdAt: p.createdAt.toISOString(),
      agencyName: p.agency.name,
      agencyCountry: p.agency.country,
      threadId: p.threads[0]?.id ?? null,
      workers: workerCards,
    });
  }

  const badge = JOB_ORDER_STATUS_BADGE[order.status];
  return (
    <div>
      <PageHeader
        title={`${POSITION_LABEL[order.position]} × ${order.quantity}`}
        subtitle={`${order.nationalityPref ?? "أي جنسية"} · ${order.salaryOffer ? `${order.salaryOffer} ${order.currency}` : "راتب قابل للتفاوض"} · عقد ${order.contractMonths} شهرًا`}
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />

      <h2 className="mb-4 text-lg font-semibold">العروض الواردة ({views.length})</h2>
      {views.length === 0 ? (
        <EmptyState
          title="لم تصل عروض بعد"
          hint="الوكالات الموثّقة ترى هذا الأمر في لوحة الطلب وستقدم عروضها هنا."
        />
      ) : (
        <div className="space-y-6">
          {views.map((p) => (
            <ProposalReview key={p.id} proposal={p} statusBadge={PROPOSAL_STATUS_BADGE[p.status]} />
          ))}
        </div>
      )}
    </div>
  );
}
