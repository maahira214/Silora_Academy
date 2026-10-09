"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ClassType, Role, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { runAction, UserError, type ActionResult } from "@/lib/action-result";
import { isValidTimeZone, zonedToUtc } from "@/lib/time";
import {
  addOneOffSession,
  addSchedule,
  addStudentToGroup,
  cancelSession,
  createCourse,
  endCourse,
  removeStudentFromGroup,
  replaceTeacher,
  rescheduleSession,
  setChatEnabled,
  stopSchedule,
  updateMeetLink,
  type ScheduleInput,
} from "@/server/courses";
import { CONSENT_METHODS, changeStaffRole, createUser, setGuardianConsent, setUserStatus, updateUser, type UserInput } from "@/server/users";
import { reviewMessage } from "@/server/chat";

/* ---------- parsing helpers ---------- */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;

const tzSchema = z.string().refine(isValidTimeZone, "Choose a valid timezone.");

function userInputFrom(fd: FormData): UserInput {
  const base = z
    .object({
      name: z.string().min(2, "Enter the full name."),
      email: z.string().email("Enter a valid Google account email."),
      timezone: z.union([tzSchema, z.literal("")]),
    })
    .parse({ name: str(fd, "name"), email: str(fd, "email"), timezone: str(fd, "timezone") });
  return {
    ...base,
    phone: opt(fd, "phone"),
    timezone: base.timezone || null,
    headline: opt(fd, "headline"),
    grade: opt(fd, "grade"),
    board: opt(fd, "board"),
    guardianName: opt(fd, "guardianName"),
    guardianPhone: opt(fd, "guardianPhone"),
    guardianEmail: opt(fd, "guardianEmail"),
    notes: opt(fd, "notes"),
  };
}

function scheduleFrom(fd: FormData, prefix = ""): ScheduleInput | null {
  const weekdays = fd.getAll(prefix + "weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  const startTime = str(fd, prefix + "startTime");
  if (!weekdays.length) return null; // no recurring schedule
  const timezone = tzSchema.parse(str(fd, prefix + "timezone") || str(fd, "timezone"));
  const durationMin = Number(str(fd, prefix + "durationMin"));
  const validFrom = str(fd, prefix + "validFrom");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) throw new UserError("Choose the schedule start date.");
  const validUntil = str(fd, prefix + "validUntil") || null;
  return { weekdays, startTime, durationMin, timezone, validFrom, validUntil };
}

function localDateTimeFrom(fd: FormData, tz: string) {
  const date = str(fd, "date");
  const time = str(fd, "time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new UserError("Choose a date and time.");
  return zonedToUtc(date, time, tz);
}

/* ---------- people ---------- */

export async function createPersonAction(role: Role, _: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const res = await runAction(async () => {
    const actor = await requirePermission(role === "SUPER_ADMIN" || role === "OPERATIONS" ? "staff.manage" : "people.edit");
    const u = await createUser(actor, role, userInputFrom(fd));
    id = u.id;
  });
  if (res.error) return res;
  redirect(role === "TEACHER" ? `/admin/teachers/${id}` : role === "STUDENT" ? `/admin/students/${id}` : "/admin/staff");
}

export async function updatePersonAction(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("people.edit");
    await updateUser(actor, userId, userInputFrom(fd));
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Saved." };
  });
}

export async function setUserStatusAction(userId: string, status: UserStatus, _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("people.suspend");
    await setUserStatus(actor, userId, status);
    revalidatePath("/admin", "layout");
    return { ok: true, message: status === "ACTIVE" ? "Account reactivated." : `Account ${status.toLowerCase()}. All access was revoked.` };
  });
}

export async function changeStaffRoleAction(userId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("staff.manage");
    const role = z.enum(["SUPER_ADMIN", "OPERATIONS"]).parse(str(fd, "role"));
    await changeStaffRole(actor, userId, role);
    revalidatePath("/admin/staff");
    return { ok: true, message: "Role updated." };
  });
}

/* ---------- classes ---------- */

export async function createCourseAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = "";
  const res = await runAction(async () => {
    const actor = await requirePermission("classes.manage");
    const type = z.enum(["ONE_TO_ONE", "GROUP"]).parse(str(fd, "type")) as ClassType;
    const timezone = tzSchema.parse(str(fd, "timezone"));
    const studentIds = type === "ONE_TO_ONE" ? [str(fd, "studentId")].filter(Boolean) : fd.getAll("studentIds").map(String);
    const course = await createCourse(actor, {
      type,
      subjectName: str(fd, "subject"),
      teacherId: str(fd, "teacherId"),
      studentIds,
      title: opt(fd, "title") ?? undefined,
      grade: opt(fd, "grade"),
      board: opt(fd, "board"),
      timezone,
      meetLink: opt(fd, "meetLink"),
      schedule: scheduleFrom(fd),
    });
    id = course.id;
  });
  if (res.error) return res;
  redirect(`/admin/classes/${id}`);
}

export async function updateMeetLinkAction(courseId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    await updateMeetLink(actor, courseId, str(fd, "meetLink"));
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Meet link saved. It will be used for every lesson of this class." };
  });
}

export async function addScheduleAction(courseId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    const s = scheduleFrom(fd);
    if (!s) throw new UserError("Pick the days and time.");
    const count = await addSchedule(actor, courseId, s);
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: `Schedule added — ${count} lessons created.` };
  });
}

export async function stopScheduleAction(courseId: string, scheduleId: string, _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    await stopSchedule(actor, scheduleId);
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Schedule stopped. Future lessons from it were removed." };
  });
}

export async function addLessonAction(courseId: string, tz: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("sessions.manage");
    await addOneOffSession(actor, courseId, localDateTimeFrom(fd, tz), Number(str(fd, "durationMin")));
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Lesson added." };
  });
}

export async function endCourseAction(courseId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    await endCourse(actor, courseId, str(fd, "reason"));
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Class ended. Future lessons were cancelled and chat is now read-only." };
  });
}

export async function replaceTeacherAction(courseId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  let newId = "";
  const res = await runAction(async () => {
    const actor = await requirePermission("classes.manage");
    const c = await replaceTeacher(actor, courseId, str(fd, "teacherId"), opt(fd, "meetLink"));
    newId = c.id;
  });
  if (res.error) return res;
  redirect(`/admin/classes/${newId}`);
}

export async function addStudentAction(courseId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    await addStudentToGroup(actor, courseId, str(fd, "studentId"));
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Student added." };
  });
}

export async function removeStudentAction(courseId: string, studentId: string, _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("classes.manage");
    await removeStudentFromGroup(actor, courseId, studentId);
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: "Student removed from the group." };
  });
}

export async function setChatEnabledAction(courseId: string, enabled: boolean, _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("chat.control");
    await setChatEnabled(actor, courseId, enabled);
    revalidatePath(`/admin/classes/${courseId}`);
    return { ok: true, message: enabled ? "Messaging enabled." : "Messaging paused for this class." };
  });
}

/* ---------- lessons ---------- */

export async function cancelSessionAction(sessionId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("sessions.manage");
    await cancelSession(actor, sessionId, str(fd, "reason"));
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Lesson cancelled and participants notified." };
  });
}

export async function rescheduleSessionAction(sessionId: string, tz: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("sessions.manage");
    await rescheduleSession(actor, sessionId, localDateTimeFrom(fd, tz), Number(str(fd, "durationMin")));
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Lesson rescheduled and participants notified." };
  });
}

export async function markSessionAction(sessionId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("sessions.manage");
    const status = z.enum(["COMPLETED", "TEACHER_ABSENT", "STUDENT_ABSENT", "NO_SHOW", "TECHNICAL_ISSUE"]).parse(str(fd, "status"));
    const s = await db.classSession.findFirst({ where: { id: sessionId, orgId: actor.orgId } });
    if (!s) throw new UserError("Lesson not found.");
    if (s.status === "CANCELLED") throw new UserError("This lesson was cancelled.");
    await db.classSession.update({ where: { id: s.id }, data: { status, completedAt: s.completedAt ?? new Date() } });
    await audit({ orgId: actor.orgId, actorId: actor.id, action: "SESSION_OUTCOME_SET", targetType: "ClassSession", targetId: s.id, metadata: { status } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Outcome saved." };
  });
}

/* ---------- alerts ---------- */

export async function updateAlertAction(alertId: string, status: "ACKNOWLEDGED" | "RESOLVED", _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("alerts.manage");
    const a = await db.alert.findFirst({ where: { id: alertId, orgId: actor.orgId } });
    if (!a) throw new UserError("Alert not found.");
    await db.alert.update({
      where: { id: a.id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null, resolvedById: actor.id },
    });
    await audit({ orgId: actor.orgId, actorId: actor.id, action: `ALERT_${status}`, targetType: "Alert", targetId: a.id });
    revalidatePath("/admin", "layout");
  });
}

/* ---------- moderation ---------- */

export async function reviewMessageAction(messageId: string, decision: "approve" | "remove" | "dismiss", _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("chat.review");
    await reviewMessage(actor, messageId, decision);
    revalidatePath("/admin", "layout");
  });
}

/* ---------- settings ---------- */

export async function updateSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("settings.manage");
    const int = (k: string, min: number, max: number, label: string) =>
      z.coerce.number().int().min(min, `${label} must be at least ${min}.`).max(max, `${label} must be at most ${max}.`).parse(str(fd, k));
    const reminders = str(fd, "reminderMinutesBefore")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 1440);
    const data = {
      name: z.string().min(2).parse(str(fd, "name")),
      timezone: tzSchema.parse(str(fd, "timezone")),
      joinOpensMinutesBefore: int("joinOpensMinutesBefore", 0, 60, "Join window"),
      teacherGraceMinutes: int("teacherGraceMinutes", 1, 60, "Teacher grace period"),
      studentGraceMinutes: int("studentGraceMinutes", 1, 60, "Student grace period"),
      maxUploadMb: int("maxUploadMb", 1, 50, "Max upload size"),
      reminderMinutesBefore: [...new Set(reminders)].sort((a, b) => b - a),
      contactPolicy: z.enum(["WARN", "FLAG", "BLOCK", "QUARANTINE"]).parse(str(fd, "contactPolicy")),
      allowPrivateGroupChat: fd.get("allowPrivateGroupChat") === "on",
    };
    await db.organization.update({ where: { id: actor.orgId }, data });
    await audit({ orgId: actor.orgId, actorId: actor.id, action: "SETTINGS_UPDATED", targetType: "Organization", targetId: actor.orgId, metadata: data });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

/* ---------- parent/guardian consent ---------- */

export async function recordGuardianConsentAction(studentId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("people.edit");
    const method = z.enum(CONSENT_METHODS, { message: "Choose how the parent agreed." }).parse(str(fd, "method"));
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date they agreed.").parse(str(fd, "date"));
    await setGuardianConsent(actor, studentId, { method, at: zonedToUtc(date, "12:00", actor.org.timezone) });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Parent consent recorded." };
  });
}

export async function removeGuardianConsentAction(studentId: string, _: ActionResult): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("people.edit");
    await setGuardianConsent(actor, studentId, null);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Parent consent removed. If the parent withdrew consent, deactivate the student's account." };
  });
}
