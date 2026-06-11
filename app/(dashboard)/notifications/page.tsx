import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requirePageContext } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { PageHeader, EmptyState, Badge, cn } from "@/components/ui";
import { MarkAllRead } from "./MarkAllRead";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requirePageContext();
  if (!ctx.org) redirect("/admin");

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.orgId, ctx.org.id),
    orderBy: desc(notifications.createdAt),
    limit: 100,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="التنبيهات" action={rows.some((n) => !n.readAt) ? <MarkAllRead /> : undefined} />
      {rows.length === 0 ? (
        <EmptyState title="لا تنبيهات" hint="ستظهر هنا تنبيهات العروض والمراحل وانتهاء المستندات." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              className={cn("panel block p-4 transition hover:border-accent/50", n.readAt && "opacity-60")}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{n.title}</p>
                {!n.readAt && <Badge tone="gold">جديد</Badge>}
              </div>
              {n.body ? <p className="mt-1 text-xs text-ink-muted">{n.body}</p> : null}
              <p className="mt-1 text-[10px] text-ink-muted" dir="ltr">
                {n.createdAt.toLocaleString("ar")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
