import Link from "next/link";

/**
 * Public marketing/auth shell. PRIVACY: nothing under app/(public) may import
 * candidate-data components or schemas — enforced by scripts/check-public-privacy.sh.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-navy-800">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold text-accent">
            وكيل<span className="text-ink">برو</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary">
              تسجيل الدخول
            </Link>
            <Link href="/request-invite" className="btn-primary">
              طلب دعوة
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-navy-800 py-6 text-center text-xs text-ink-muted">
        WakilPro — منصة خاصة بالدعوة فقط · جميع الحقوق محفوظة {new Date().getFullYear()}
      </footer>
    </div>
  );
}
