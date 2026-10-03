import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

// Marks a notification read, then follows its (internal) link.
export async function GET(req: NextRequest, ctx: RouteContext<"/notifications/[id]">) {
  const { id } = await ctx.params;
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return NextResponse.redirect(new URL("/", appUrl));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  const link = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/";
  return NextResponse.redirect(new URL(link, appUrl));
}
