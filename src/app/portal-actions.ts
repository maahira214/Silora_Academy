"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCourseAccess, requireUser } from "@/lib/authz";
import { runAction, UserError, type ActionResult } from "@/lib/action-result";
import { POLICY_VERSION } from "@/lib/legal";
import { openPrivateThread, sendMessage } from "@/server/chat";
import { notify } from "@/server/notifications";

export async function sendMessageAction(threadId: string, fd: FormData): Promise<{ error?: string; warning?: string; ok?: boolean }> {
  let warning: string | undefined;
  const res = await runAction(async () => {
    const user = await requireUser();
    const file = fd.get("file");
    const r = await sendMessage(user, threadId, String(fd.get("body") ?? ""), file instanceof File ? file : null);
    if (r.status === "BLOCKED") throw new UserError("Not sent: personal contact details (phone, email, social media) can't be shared on Silora.");
    if (r.status === "QUARANTINED") warning = "Your message is waiting for review by Silora before it is delivered.";
    else warning = r.warning;
  });
  return res.error ? res : { ok: true, warning };
}

export async function reportIssueAction(sessionId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const note = String(fd.get("note") ?? "").trim().slice(0, 500);
    if (!note) throw new UserError("Describe the problem briefly.");
    const session = await db.classSession.findFirst({ where: { id: sessionId, orgId: user.orgId } });
    if (!session) throw new UserError("Lesson not found.");
    const access = await getCourseAccess(user, session.courseId);
    if (!access || access.as === "staff") throw new UserError("You aren't part of this class.");

    const line = `${user.name}: ${note}`;
    await db.classSession.update({
      where: { id: session.id },
      data: { issueNote: session.issueNote ? `${session.issueNote}\n${line}` : line },
    });
    await db.alert.create({
      data: {
        orgId: user.orgId,
        courseId: session.courseId,
        sessionId: session.id,
        type: "ISSUE_REPORTED",
        severity: "WARNING",
        title: `Technical issue reported by ${access.as}`,
        details: `${access.course.title}: ${line}`,
        dedupeKey: `issue:${session.id}:${user.id}:${Date.now()}`,
      },
    });
    await audit({ orgId: user.orgId, actorId: user.id, action: "ISSUE_REPORTED", targetType: "ClassSession", targetId: session.id });
    revalidatePath("/", "layout");
    return { ok: true, message: "Thanks. Silora operations has been notified and will help shortly." };
  });
}

export async function openPrivateThreadAction(courseId: string, studentId: string) {
  const user = await requireUser();
  const thread = await openPrivateThread(user, courseId, studentId);
  redirect(`/${user.role === "TEACHER" ? "teacher" : "student"}/messages/${thread.id}`);
}

/** "Need help?" from any teacher/student screen: raises an alert for Silora operations. */
export async function requestHelpAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "TEACHER" && user.role !== "STUDENT") throw new UserError("Help requests are for teachers and students.");
    const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
    if (!note) throw new UserError("Tell us briefly what you need help with.");
    const page = String(fd.get("page") ?? "").slice(0, 200);

    // A few requests in a row are fine; stop accidental floods.
    const recent = await db.alert.count({
      where: { orgId: user.orgId, dedupeKey: { startsWith: `help:${user.id}:` }, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    });
    if (recent >= 3) throw new UserError("We already have your messages. Silora Academy will contact you soon.");

    const who = user.role === "TEACHER" ? "Teacher" : "Student";
    await db.alert.create({
      data: {
        orgId: user.orgId,
        type: "HELP_REQUESTED",
        severity: "WARNING",
        title: `${who} ${user.name} asked for help`,
        details: `${note}${page ? `\n(Page: ${page})` : ""}`,
        dedupeKey: `help:${user.id}:${Date.now()}`,
      },
    });
    const staff = await db.user.findMany({ where: { orgId: user.orgId, role: { in: ["SUPER_ADMIN", "OPERATIONS"] }, status: "ACTIVE" }, select: { id: true } });
    await notify(
      staff.map((s) => s.id),
      { title: `${who} ${user.name} asked for help`, body: note.slice(0, 140), link: `/admin/people/${user.id}` },
    );
    await audit({ orgId: user.orgId, actorId: user.id, action: "HELP_REQUESTED", targetType: "User", targetId: user.id });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Sent. Silora Academy will contact you soon." };
  });
}

/** Closes the first-time welcome cards for good. */
export async function finishWelcomeAction() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { welcomedAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Records that the user agreed to the current privacy policy. */
export async function acceptPolicyAction() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { policyVersion: POLICY_VERSION, policyAcceptedAt: new Date() } });
  await audit({ orgId: user.orgId, actorId: user.id, action: "POLICY_ACCEPTED", targetType: "User", targetId: user.id, metadata: { version: POLICY_VERSION } });
  revalidatePath("/", "layout");
}
