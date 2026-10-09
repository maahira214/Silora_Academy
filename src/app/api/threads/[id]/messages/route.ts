import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getThreadAccess, listMessages, markThreadRead } from "@/server/chat";

// Polled by the open chat window every few seconds for new messages.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/threads/[id]/messages">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`poll:${user.id}`, LIMITS.poll).ok) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });

  const access = await getThreadAccess(user, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const afterParam = req.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : undefined;
  const messages = await listMessages(user, access, { after: after && !isNaN(+after) ? after : undefined });
  if (messages.length && access.as !== "reviewer") await markThreadRead(user, id);

  return NextResponse.json(
    { messages, canPost: access.canPost, readOnlyReason: access.readOnlyReason ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
