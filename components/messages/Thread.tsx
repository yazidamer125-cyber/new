"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; orgId: string | null };
};

export function Thread({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res.ok) {
        toast.error("تعذّر إرسال الرسالة");
        return;
      }
      setDraft("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (messages === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-navy-800 bg-navy-950 p-4">
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-muted">لا رسائل بعد — ابدأ الحوار.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-navy-900 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-accent">{m.sender.name}</p>
                <p className="text-[10px] text-ink-muted" dir="ltr">
                  {new Date(m.createdAt).toLocaleString("ar")}
                </p>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="اكتب رسالة…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={busy || !draft.trim()} onClick={() => void send()}>
          إرسال
        </button>
      </div>
    </div>
  );
}
