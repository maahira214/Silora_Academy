"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCourseAccess, requireUser } from "@/lib/authz";
import { runAction, UserError, type ActionResult } from "@/lib/action-result";
import { openPrivateThread, sendMessage } from "@/server/chat";

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
