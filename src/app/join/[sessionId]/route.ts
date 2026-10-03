import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseAccess, homeFor } from "@/lib/authz";
import { joinWindow } from "@/lib/session-status";
import { resolveJoinAlerts } from "@/server/monitor";

/**
 * The only way teachers/students reach a class's Meet link. Possession of a
 * link is not authorization: we check the live assignment every time, record
 * the join, then redirect to the relationship's permanent Meet link.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/join/[sessionId]">) {
  const { sessionId } = await ctx.params;
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));

  const blocked = (reason: string) =>
    NextResponse.redirect(new URL(`/join-status?reason=${reason}&home=${encodeURIComponent(homeFor(user.role))}`, appUrl));

  const session = await db.classSession.findFirst({ where: { id: sessionId, orgId: user.orgId } });
  if (!session) return blocked("not_found");

  const access = await getCourseAccess(user, session.courseId);
  if (!access) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "CLASS_JOIN", targetType: "ClassSession", targetId: session.id, result: "DENIED", metadata: { reason: "not_assigned" } });
    return blocked("not_assigned");
  }
  if (!access.active) return blocked("class_ended");

  if (access.as !== "staff") {
    const w = joinWindow(session, user.org.joinOpensMinutesBefore, new Date());
    if (w !== "open") return blocked(w);
  }

  if (!access.course.meetUrl) {
    await db.alert.upsert({
      where: { dedupeKey: `meet_missing:${session.id}` },
      update: {},
      create: {
        orgId: user.orgId,
        courseId: session.courseId,
        sessionId: session.id,
        type: "MEET_MISSING",
        severity: "CRITICAL",
        title: "Class has no Meet link",
        details: `${user.name} tried to join "${access.course.title}" but no Google Meet link is set.`,
        dedupeKey: `meet_missing:${session.id}`,
      },
    });
    return blocked("no_meet");
  }

  const now = new Date();
  if (access.as === "staff") {
    await audit({ orgId: user.orgId, actorId: user.id, action: "CLASS_OPENED_BY_STAFF", targetType: "ClassSession", targetId: session.id });
  } else {
    await db.attendance.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
      update: { lastJoinAt: now, joinCount: { increment: 1 } },
      create: { sessionId: session.id, userId: user.id, firstJoinAt: now, lastJoinAt: now, joinCount: 1 },
    });
    await resolveJoinAlerts(session.id, access.as === "teacher" ? "TEACHER" : "STUDENT");
    await audit({ orgId: user.orgId, actorId: user.id, action: "CLASS_JOINED", targetType: "ClassSession", targetId: session.id, metadata: { as: access.as } });
  }

  return NextResponse.redirect(access.course.meetUrl);
}
