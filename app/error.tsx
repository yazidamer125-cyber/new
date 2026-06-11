"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-3xl">⚠</p>
      <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-sm text-ink-muted">سُجّل الخطأ لدينا. جرّب مرة أخرى، وإن تكرر تواصل مع الدعم.</p>
      <button type="button" className="btn-primary" onClick={() => reset()}>
        إعادة المحاولة
      </button>
    </div>
  );
}
