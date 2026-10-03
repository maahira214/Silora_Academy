import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { getThreadAccess } from "@/server/chat";
import { ALLOWED_UPLOADS, getObject } from "@/server/storage";

// Attachments are private: the viewer must currently have access to the conversation.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const att = await db.attachment.findUnique({ where: { id }, include: { message: true } });
  if (!att?.message) return new NextResponse("Not found", { status: 404 });

  const access = await getThreadAccess(user, att.message.threadId);
  const visible =
    access &&
    (att.message.status === "VISIBLE" || att.message.senderId === user.id || access.as === "reviewer");
  if (!visible) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "FILE_DOWNLOAD", targetType: "Attachment", targetId: id, result: "DENIED" });
    return new NextResponse("Not found", { status: 404 });
  }

  const data = await getObject(att.storageKey);
  const ext = Object.entries(ALLOWED_UPLOADS).find(([, v]) => v.mime === att.mimeType);
  const inline = req.nextUrl.searchParams.get("download") !== "1" && (ext?.[1].inline ?? false);
  if (!inline) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "FILE_DOWNLOADED", targetType: "Attachment", targetId: id });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
