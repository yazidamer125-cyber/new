import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { proposals, workers } from "@/lib/db/schema";
import { PageHeader, Badge, PROPOSAL_STATUS_BADGE, POSITION_LABEL, WORKER_STATUS_BADGE } from "@/components/ui";
import { Thread } from "@/components/messages/Thread";
import { WithdrawButton } from "./WithdrawButton";

export const dynamic = "force-dynamic";

/** Agency-side proposal detail: own workers, thread, withdraw. */
export default async function ProposalDetailPage({ params }: { params: { id: string } }) {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "source_agency") redirect("/proposals");

  const proposal = await db.query.proposals.findFirst({
    where: and(eq(proposals.id, params.id), eq(proposals.agencyId, ctx.org.id)),
    with: {
      jobOrder: { with: { office: { columns: { name: true, country: true } } } },
      workers: true,
      threads: { columns: { id: true } },
    },
  });
  if (!proposal) notFound();

  const workerRows =
    proposal.workers.length === 0
      ? []
      : await db
          .select()
          .from(workers)
          .where(
            and(
              inArray(
                workers.id,
                proposal.workers.map((w) => w.workerId),
              ),
              eq(workers.agencyId, ctx.org.id), // own workers only
            ),
          );
  const markByWorker = new Map(proposal.workers.map((w) => [w.workerId, w.status]));

  const badge = PROPOSAL_STATUS_BADGE[proposal.status];
  const reveal = ["shortlisted", "accepted"].includes(proposal.status);
  const officeLabel = reveal
    ? `${proposal.jobOrder.office.name} — ${proposal.jobOrder.office.country}`
    : `مكتب موثّق — ${proposal.jobOrder.office.country}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`عرض: ${POSITION_LABEL[proposal.jobOrder.position]} × ${proposal.jobOrder.quantity}`}
        subtitle={officeLabel}
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />

      <div className="panel mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">المرشحون في هذا العرض</h2>
        <div className="space-y-2">
          {workerRows.map((w) => {
            const mark = markByWorker.get(w.id) ?? "proposed";
            const wBadge = WORKER_STATUS_BADGE[w.status];
            return (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-700 p-3">
                <div>
                  <p className="text-sm font-medium">{w.fullName}</p>
                  <p className="text-xs text-ink-muted">
                    {POSITION_LABEL[w.position]} · {w.nationality}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={wBadge.tone}>{wBadge.label}</Badge>
                  {mark === "selected" ? (
                    <Badge tone="green">اختاره المكتب ✓</Badge>
                  ) : mark === "rejected" ? (
                    <Badge tone="red">استُبعد</Badge>
                  ) : (
                    <Badge tone="blue">قيد المراجعة</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {proposal.status === "pending" || proposal.status === "shortlisted" ? (
          <div className="mt-4 border-t border-navy-800 pt-4">
            <WithdrawButton proposalId={proposal.id} />
          </div>
        ) : null}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink-muted">المحادثة مع المكتب</h2>
      {proposal.threads[0] ? <Thread threadId={proposal.threads[0].id} /> : <p className="text-sm text-ink-muted">لا محادثة.</p>}
    </div>
  );
}
