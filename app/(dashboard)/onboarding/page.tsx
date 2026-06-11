import { redirect } from "next/navigation";
import { requirePageContext } from "@/lib/auth/page-guards";
import { PageHeader, Badge, VERIFICATION_BADGE } from "@/components/ui";
import { LicenseForm } from "./LicenseForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await requirePageContext();
  if (ctx.user.role === "platform_admin") redirect("/admin");
  if (!ctx.org) redirect("/login");
  if (ctx.org.verificationStatus === "verified") redirect("/dashboard");

  const org = ctx.org;
  const hasLicense = Boolean(org.licenseDocKey);
  const rejected = org.verificationStatus === "rejected";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="استكمال توثيق المنشأة"
        subtitle="لا يمكن استخدام المنصة قبل التحقق من ترخيص منشأتك — هذه حماية لجميع الأطراف."
      />

      <ol className="space-y-4">
        <li className="panel flex items-start gap-4 p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">✓</span>
          <div>
            <p className="font-semibold">إنشاء الحساب</p>
            <p className="text-sm text-ink-muted">
              {org.name} — {org.type === "source_agency" ? "وكالة توريد" : "مكتب استقدام"} · {org.country}
            </p>
          </div>
        </li>

        <li className="panel flex items-start gap-4 p-5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              hasLicense && !rejected ? "bg-emerald-500/15 text-emerald-300" : "bg-accent/15 text-accent"
            }`}
          >
            {hasLicense && !rejected ? "✓" : "٢"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">رفع رخصة المزاولة</p>
            {rejected && (
              <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
                رُفض الطلب السابق: {org.rejectionReason ?? "بدون سبب مذكور"} — صحّح البيانات وأعد الإرسال.
              </div>
            )}
            <div className="mt-3">
              <LicenseForm
                defaultLicenseNumber={org.licenseNumber ?? ""}
                alreadySubmitted={hasLicense && !rejected}
              />
            </div>
          </div>
        </li>

        <li className="panel flex items-start gap-4 p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-ink-muted">٣</span>
          <div>
            <p className="font-semibold">مراجعة فريق المنصة</p>
            <p className="text-sm text-ink-muted">
              يدقق فريقنا الرخصة يدويًا ثم تصلكم الموافقة. الحالة الحالية:{" "}
              <Badge tone={VERIFICATION_BADGE[org.verificationStatus].tone}>
                {VERIFICATION_BADGE[org.verificationStatus].label}
              </Badge>
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
