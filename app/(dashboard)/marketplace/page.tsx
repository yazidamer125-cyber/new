import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireVerifiedPage } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { jobOrders } from "@/lib/db/schema";
import { listMarketplaceForOffice } from "@/lib/db/marketplace";
import { PageHeader } from "@/components/ui";
import { MarketplaceBoard } from "@/components/marketplace/MarketplaceBoard";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const ctx = await requireVerifiedPage();
  if (ctx.org.type !== "recruitment_office") redirect("/dashboard");

  const [cards, openOrders] = await Promise.all([
    listMarketplaceForOffice(ctx),
    db.query.jobOrders.findMany({
      where: and(eq(jobOrders.officeId, ctx.org.id), eq(jobOrders.status, "open")),
      orderBy: desc(jobOrders.createdAt),
      columns: { id: true, position: true, quantity: true, nationalityPref: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="سوق الكوادر"
        subtitle="كل الكوادر المتاحة (بموافقات موقّعة) من الوكالات الموثّقة. الاسم مختصر والملف الكامل يظهر بعد الطلب."
      />
      <MarketplaceBoard cards={cards} jobOrders={openOrders} />
    </div>
  );
}
