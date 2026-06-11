import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
      <Link href="/" className="btn-secondary">
        العودة للرئيسية
      </Link>
    </div>
  );
}
