import Link from "next/link";

/**
 * Marketing landing page. STRICTLY zero candidate data here (product rule #1):
 * no profiles, no counts, no photos — only a description of the service.
 */
export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <section className="py-24 text-center">
        <p className="mb-4 inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-sm text-accent">
          منصة خاصة · بالدعوة فقط · B2B
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          جسر موثوق بين وكالات الاستقدام الخارجية
          <span className="text-accent"> ومكاتب الاستقدام المرخّصة</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">
          وكيل برو تربط وكالات التوريد في إثيوبيا والفلبين وسريلانكا وكينيا وأوغندا وبنغلادش بمكاتب الاستقدام
          في الأردن ودول الخليج — عبر أوامر توظيف وعروض منظّمة، بسرية تامة وتدقيق كامل للتراخيص.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/request-invite" className="btn-primary px-8 py-3 text-base">
            اطلب دعوة لمنشأتك
          </Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">
            دخول الأعضاء
          </Link>
        </div>
      </section>

      <section className="grid gap-6 pb-24 md:grid-cols-3">
        {[
          {
            title: "تحقق إلزامي من الترخيص",
            body: "لا تُفتح أي صلاحيات قبل مراجعة فريقنا لرخصة المنشأة واعتمادها. كل طرف تتعامل معه موثّق.",
          },
          {
            title: "خصوصية صارمة",
            body: "لا يوجد أي دليل عام. البيانات تُعرض فقط بين شركاء معتمدين ضمن عرض نشط، مع سجل تدقيق لكل اطلاع.",
          },
          {
            title: "خط سير مكتمل",
            body: "من أمر التوظيف إلى العرض فالتعاقد، ثم التأشيرة والفحص الطبي وOKB حتى الوصول — كله في مكان واحد.",
          },
        ].map((f) => (
          <div key={f.title} className="panel p-6">
            <h3 className="mb-2 text-lg font-semibold text-accent">{f.title}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="pb-24">
        <div className="panel grid gap-8 p-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">لمكاتب الاستقدام</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted">
              <li>• انشر أوامر التوظيف وحدد الجنسية والمهنة والراتب</li>
              <li>• استقبل عروضًا من وكالات موثّقة فقط</li>
              <li>• تابع الملف من التعاقد حتى الوصول، بما فيها طلبات OKB</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">لوكالات التوريد</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-muted">
              <li>• اعرض كوادرك على مكاتب مرخّصة في الأردن والخليج</li>
              <li>• موافقات موقّعة وإلزامية قبل أي مشاركة للبيانات</li>
              <li>• لوحة متابعة لمراحل الإجراءات بعد القبول</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
