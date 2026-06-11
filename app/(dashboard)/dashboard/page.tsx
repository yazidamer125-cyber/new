import Link from "next/link";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { workers, jobOrders, proposals, placements, notifications } from "@/lib/db/schema";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireVerifiedPage();
  const isAgency = ctx.org.type === "source_agency";

  const stats: { label: string; value: number; href: string }[] = [];
  if (isAgency) {
    const [workerCount] = await db
      .select({ n: count() })
      .from(workers)
      .where(eq(workers.agencyId, ctx.org.id));
    const [availableCount] = await db
      .select({ n: count() })
      .from(workers)
      .where(and(eq(workers.agencyId, ctx.org.id), eq(workers.status, "available")));
    const [proposalCount] = await db
      .select({ n: count() })
      .from(proposals)
      .where(and(eq(proposals.agencyId, ctx.org.id), inArray(proposals.status, ["pending", "shortlisted"])));
    const [placementCount] = await db
      .select({ n: count() })
      .from(placements)
      .where(eq(placements.agencyId, ctx.org.id));
    stats.push(
      { label: "إجمالي الكوادر", value: workerCount.n, href: "/workers" },
      { label: "جاهز للترشيح", value: availableCount.n, href: "/workers" },
      { label: "عروض قيد الرد", value: proposalCount.n, href: "/proposals" },
      { label: "ملفات قيد الإجراءات", value: placementCount.n, href: "/placements" },
    );
  } else {
    const [openOrders] = await db
      .select({ n: count() })
      .from(jobOrders)
      .where(and(eq(jobOrders.officeId, ctx.org.id), eq(jobOrders.status, "open")));
    const own = await db.select({ id: jobOrders.id }).from(jobOrders).where(eq(jobOrders.officeId, ctx.org.id));
    const [pendingProposals] =
      own.length > 0
        ? await db
            .select({ n: count() })
            .from(proposals)
            .where(
              and(
                inArray(
                  proposals.jobOrderId,
                  own.map((j) => j.id),
                ),
                eq(proposals.status, "pending"),
              ),
            )
        : [{ n: 0 }];
    const [placementCount] = await db
      .select({ n: count() })
      .from(placements)
      .where(eq(placements.officeId, ctx.org.id));
    stats.push(
      { label: "أوامر توظيف مفتوحة", value: openOrders.n, href: "/job-orders" },
      { label: "عروض بانتظار المراجعة", value: pendingProposals.n, href: "/proposals" },
      { label: "ملفات قيد الإجراءات", value: placementCount.n, href: "/placements" },
    );
  }

  const recent = await db.query.notifications.findMany({
    where: and(eq(notifications.orgId, ctx.org.id), isNull(notifications.readAt)),
    orderBy: desc(notifications.createdAt),
    limit: 6,
  });

  return (
    <div>
      <PageHeader
        title={`أهلًا، ${ctx.org.name}`}
        subtitle={isAgency ? "تابع كوادرك وعروضك من هنا." : "تابع أوامر التوظيف والعروض الواردة من هنا."}
        action={
          <Link href={isAgency ? "/workers/new" : "/job-orders/new"} className="btn-primary">
            {isAgency ? "+ إضافة كادر" : "+ أمر توظيف جديد"}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:border-accent/50">
              <p className="text-3xl font-bold text-accent">{s.value}</p>
              <p className="mt-1 text-sm text-ink-muted">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">تنبيهات غير مقروءة</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-ink-muted">لا جديد — كل شيء تحت السيطرة.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((n) => (
            <Link key={n.id} href={n.link ?? "/notifications"} className="panel block p-4 transition hover:border-accent/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{n.title}</p>
                <Badge tone="gold">جديد</Badge>
              </div>
              {n.body ? <p className="mt-1 text-xs text-ink-muted">{n.body}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
