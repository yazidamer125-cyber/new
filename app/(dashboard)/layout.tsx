import type { Metadata } from "next";
import { requirePageContext } from "@/lib/auth/page-guards";
import { Sidebar, type NavItem } from "@/components/shell/Sidebar";

// Authenticated area: always rendered per-request, never cached/ISR'd.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const AGENCY_NAV: NavItem[] = [
  { href: "/dashboard", label: "نظرة عامة", icon: "▦" },
  { href: "/workers", label: "الكوادر", icon: "👥" },
  { href: "/job-orders", label: "لوحة الطلب", icon: "📋" },
  { href: "/proposals", label: "عروضي", icon: "📨" },
  { href: "/placements", label: "الإجراءات", icon: "🛫" },
  { href: "/notifications", label: "التنبيهات", icon: "🔔" },
];

const OFFICE_NAV: NavItem[] = [
  { href: "/dashboard", label: "نظرة عامة", icon: "▦" },
  { href: "/marketplace", label: "سوق الكوادر", icon: "🛒" },
  { href: "/job-orders", label: "أوامر التوظيف", icon: "📋" },
  { href: "/proposals", label: "العروض الواردة", icon: "📨" },
  { href: "/placements", label: "الإجراءات وOKB", icon: "🛫" },
  { href: "/notifications", label: "التنبيهات", icon: "🔔" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "توثيق المنشآت", icon: "🛡" },
  { href: "/admin/orgs", label: "إدارة المنشآت", icon: "🏢" },
  { href: "/admin/invitations", label: "الدعوات", icon: "✉" },
];

const ONBOARDING_NAV: NavItem[] = [{ href: "/onboarding", label: "استكمال التوثيق", icon: "🛡" }];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext();
  const isAdmin = ctx.user.role === "platform_admin";
  const verified = ctx.org?.verificationStatus === "verified";

  // Rule #3: pending orgs see ONLY the onboarding checklist.
  const items = isAdmin
    ? ADMIN_NAV
    : !verified
      ? ONBOARDING_NAV
      : ctx.org!.type === "source_agency"
        ? AGENCY_NAV
        : OFFICE_NAV;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={isAdmin ? "WakilPro" : (ctx.org?.name ?? "")}
        orgBadge={isAdmin ? "admin" : ((ctx.org?.verificationStatus ?? "pending") as "verified" | "pending" | "rejected")}
        userName={ctx.user.name}
        items={items}
      />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
