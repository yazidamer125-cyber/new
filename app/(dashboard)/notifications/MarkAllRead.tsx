"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications", { method: "PATCH" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? "…" : "تمييز الكل كمقروء"}
    </button>
  );
}
