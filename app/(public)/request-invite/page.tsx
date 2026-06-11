import type { Metadata } from "next";
import { RequestInviteForm } from "./RequestInviteForm";

export const metadata: Metadata = {
  title: "طلب دعوة",
  description: "اطلب دعوة لمنشأتك للانضمام إلى منصة وكيل برو الخاصة.",
};

export default function RequestInvitePage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-16">
      <h1 className="mb-2 text-2xl font-bold">طلب دعوة للانضمام</h1>
      <p className="mb-8 text-sm text-ink-muted">
        المنصة خاصة وبالدعوة فقط. يراجع فريقنا كل طلب ويتواصل معكم عبر البريد خلال أيام عمل.
      </p>
      <RequestInviteForm />
    </div>
  );
}
