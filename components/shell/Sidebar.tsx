"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Badge, VERIFICATION_BADGE, cn } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string };

type Props = {
  orgName: string;
  orgBadge: "verified" | "pending" | "rejected" | "admin";
  userName: string;
  items: NavItem[];
};

export function Sidebar({ orgName, orgBadge, userName, items }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-l border-navy-800 bg-navy-900 transition-all",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-5">
        {!collapsed && (
          <Link href="/dashboard" className="truncate text-lg font-bold text-accent">
            وكيل<span className="text-ink">برو</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg border border-navy-700 px-2 py-1 text-xs text-ink-muted hover:text-accent"
          aria-label="طي القائمة"
        >
          {collapsed ? "⟸" : "⟹"}
        </button>
      </div>

      {!collapsed && (
        <div className="mx-4 mb-4 rounded-lg border border-navy-800 bg-navy-950 p-3">
          <p className="truncate text-sm font-semibold">{orgName}</p>
          <div className="mt-1.5">
            {orgBadge === "admin" ? (
              <Badge tone="gold">إدارة المنصة</Badge>
            ) : (
              <Badge tone={VERIFICATION_BADGE[orgBadge].tone}>{VERIFICATION_BADGE[orgBadge].label}</Badge>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active ? "bg-accent/15 font-semibold text-accent" : "text-ink-muted hover:bg-navy-800 hover:text-ink",
                collapsed && "justify-center px-0",
              )}
            >
              <span aria-hidden>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-navy-800 p-3">
        {!collapsed && <p className="mb-2 truncate px-1 text-xs text-ink-muted">{userName}</p>}
        <button
          type="button"
          className="btn-secondary w-full text-xs"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          {collapsed ? "⎋" : "تسجيل الخروج"}
        </button>
      </div>
    </aside>
  );
}
