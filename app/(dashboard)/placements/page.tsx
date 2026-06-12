import { desc, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { placements } from "@/lib/db/schema";
import { PageHeader, EmptyState } from "@/components/ui";
import { PipelineBoard, type PlacementCard } from "@/components/placements/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  const ctx = await requireVerifiedPage();
  const isOffice = ctx.org.type === "recruitment_office";

  const rows = await db.query.placements.findMany({
    where: isOffice ? eq(placements.officeId, ctx.org.id) : eq(placements.agencyId, ctx.org.id),
    orderBy: desc(placements.stageUpdatedAt),
    with: {
      worker: { columns: { id: true, fullName: true, position: true, nationality: true } },
      office: { columns: { name: true, country: true } },
      agency: { columns: { name: true, country: true } },
      okbRequests: true,
    },
  });

  const cards: PlacementCard[] = rows.map((p) => ({
    id: p.id,
    stage: p.stage,
    notes: p.notes,
    stageUpdatedAt: p.stageUpdatedAt.toISOString(),
    workerName: p.worker.fullName,
    workerPosition: p.worker.position,
    workerNationality: p.worker.nationality,
    counterpartName: isOffice ? p.agency.name : p.office.name,
    okb: p.okbRequests.map((o) => ({ id: o.id, status: o.status, airline: o.airline, travelDate: o.travelDate })),
  }));

  return (
    <div>
      <PageHeader
        title="خط الإجراءات"
        subtitle={
          isOffice
            ? "حرّك كل ملف عبر المراحل: العقد ← التأشيرة ← الطبي ← الحجوزات ← OKB ← السفر ← الوصول."
            : "تابع تقدّم ملفات كوادرك لدى المكاتب مرحلة بمرحلة."
        }
      />
      {cards.length === 0 ? (
        <EmptyState
          title="لا ملفات قيد الإجراءات"
          hint="تُنشأ الملفات تلقائيًا عند قبول عرض على أمر توظيف."
        />
      ) : (
        <PipelineBoard cards={cards} canManage={isOffice} />
      )}
    </div>
  );
}
