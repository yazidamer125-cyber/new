import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads, messages, notifications } from "@/lib/db/schema";
import { requireVerifiedOrg, ApiError, type SessionContext } from "@/lib/auth/helpers";
import { logAction } from "@/lib/auth/audit";
import { messageSchema } from "@/lib/validation";
import { withApi, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A thread hangs off a proposal or placement; only the two parties may read/post. */
async function loadThreadForParty(ctx: SessionContext & { org: NonNullable<SessionContext["org"]> }, id: string) {
  const thread = await db.query.threads.findFirst({
    where: eq(threads.id, id),
    with: { proposal: { with: { jobOrder: true } }, placement: true },
  });
  if (!thread) throw new ApiError(404, "NOT_FOUND", "Thread not found.");
  const agencyId = thread.proposal?.agencyId ?? thread.placement?.agencyId;
  const officeId = thread.proposal?.jobOrder.officeId ?? thread.placement?.officeId;
  if (ctx.org.id !== agencyId && ctx.org.id !== officeId) {
    throw new ApiError(404, "NOT_FOUND", "Thread not found.");
  }
  return { thread, counterpartOrgId: ctx.org.id === agencyId ? officeId! : agencyId! };
}

export const GET = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  await loadThreadForParty(ctx, params.id);
  const rows = await db.query.messages.findMany({
    where: eq(messages.threadId, params.id),
    orderBy: asc(messages.createdAt),
    with: { sender: { columns: { id: true, name: true, orgId: true } } },
  });
  return json({ messages: rows });
});

export const POST = withApi(async (req: NextRequest, { params }) => {
  const ctx = await requireVerifiedOrg();
  const { counterpartOrgId } = await loadThreadForParty(ctx, params.id);
  const { body } = messageSchema.parse(await req.json());
  const [row] = await db
    .insert(messages)
    .values({ threadId: params.id, senderUserId: ctx.user.id, body })
    .returning();

  await db.insert(notifications).values({
    orgId: counterpartOrgId,
    type: "message.received",
    title: "رسالة جديدة",
    body: body.slice(0, 80),
    link: `/proposals`,
  });

  await logAction({
    actorUserId: ctx.user.id,
    actorOrgId: ctx.org.id,
    action: "message.sent",
    entityType: "thread",
    entityId: params.id,
  });

  return json({ message: row }, 201);
});
