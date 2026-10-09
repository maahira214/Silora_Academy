import "server-only";
import type { ClassType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { UserError } from "@/lib/action-result";
import type { CurrentUser } from "@/lib/auth/session";
import { parseMeetLink } from "@/lib/meet";
import { expandRecurrence, GENERATION_HORIZON_DAYS } from "@/lib/schedule";
import { dateOnly, fmtDateTime, localDateKey } from "@/lib/time";
import { notify } from "@/server/notifications";

type Tx = Prisma.TransactionClient;

export type ScheduleInput = {
  weekdays: number[];
  startTime: string;
  durationMin: number;
  timezone: string;
  validFrom: string; // YYYY-MM-DD
  validUntil?: string | null;
};

export type CreateCourseInput = {
  type: ClassType;
  subjectName: string;
  teacherId: string;
  studentIds: string[];
  title?: string;
  grade?: string | null;
  board?: string | null;
  timezone: string;
  meetLink?: string | null;
  schedule?: ScheduleInput | null;
};

/* ---------- validation helpers ---------- */

async function assertTeacher(tx: Tx, orgId: string, teacherId: string) {
  const t = await tx.user.findFirst({ where: { id: teacherId, orgId, role: "TEACHER" } });
  if (!t) throw new UserError("Choose a valid teacher.");
  if (t.status !== "ACTIVE") throw new UserError(`${t.name} is not an active teacher.`);
  return t;
}

async function assertStudents(tx: Tx, orgId: string, studentIds: string[]) {
  const ids = [...new Set(studentIds)];
  const rows = await tx.user.findMany({ where: { id: { in: ids }, orgId, role: "STUDENT" } });
  if (rows.length !== ids.length) throw new UserError("One or more students are invalid.");
  const inactive = rows.find((s) => s.status !== "ACTIVE");
  if (inactive) throw new UserError(`${inactive.name} is not an active student.`);
  return rows;
}

async function assertMeetLinkFree(tx: Tx, link: string, exceptCourseId?: string) {
  const parsed = parseMeetLink(link);
  if (!parsed) throw new UserError("That is not a valid Google Meet link (expected meet.google.com/abc-defg-hij).");
  const taken = await tx.course.findFirst({
    where: { meetCode: parsed.code, NOT: exceptCourseId ? { id: exceptCourseId } : undefined },
    select: { title: true },
  });
  if (taken) {
    throw new UserError(`This Meet link already belongs to "${taken.title}". Each class relationship needs its own Meet link.`);
  }
  return parsed;
}

export function validateSchedule(s: ScheduleInput) {
  if (!s.weekdays.length) throw new UserError("Pick at least one day of the week.");
  if (!/^\d{2}:\d{2}$/.test(s.startTime)) throw new UserError("Enter a valid start time.");
  if (s.durationMin < 15 || s.durationMin > 300) throw new UserError("Duration must be between 15 and 300 minutes.");
  if (s.validUntil && s.validUntil < s.validFrom) throw new UserError("End date must be after the start date.");
}

/* ---------- lesson generation ---------- */

/** Materialise lessons for a schedule up to the horizon. Safe to call repeatedly. */
export async function generateSessions(scheduleId: string, now = new Date(), tx: Tx | typeof db = db) {
  const schedule = await tx.schedule.findUnique({ where: { id: scheduleId }, include: { course: true } });
  if (!schedule || !schedule.active || schedule.course.status !== "ACTIVE") return 0;

  const to = new Date(now.getTime() + GENERATION_HORIZON_DAYS * 86_400_000);
  const occurrences = expandRecurrence(schedule, now, to);
  if (!occurrences.length) return 0;

  const res = await tx.classSession.createMany({
    data: occurrences.map((o) => ({
      orgId: schedule.course.orgId,
      courseId: schedule.courseId,
      scheduleId: schedule.id,
      slotAt: o.startsAt,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
    })),
    skipDuplicates: true, // unique(scheduleId, slotAt) makes this idempotent
  });
  return res.count;
}

/* ---------- course lifecycle ---------- */

export async function createCourse(actor: CurrentUser, input: CreateCourseInput) {
  const orgId = actor.orgId;
  if (input.schedule) validateSchedule(input.schedule);

  const course = await db.$transaction(async (tx) => {
    const teacher = await assertTeacher(tx, orgId, input.teacherId);
    const students = await assertStudents(tx, orgId, input.studentIds);
    if (input.type === "ONE_TO_ONE" && students.length !== 1) throw new UserError("A one-to-one class needs exactly one student.");
    if (input.type === "GROUP" && students.length < 1) throw new UserError("Add at least one student to the group.");

    const subjectName = input.subjectName.trim();
    if (!subjectName) throw new UserError("Enter a subject.");
    const subject = await tx.subject.upsert({
      where: { orgId_name: { orgId, name: subjectName } },
      update: {},
      create: { orgId, name: subjectName },
    });

    // One relationship per Student + Teacher + Subject
    if (input.type === "ONE_TO_ONE") {
      const dup = await tx.course.findFirst({
        where: {
          orgId,
          status: "ACTIVE",
          type: "ONE_TO_ONE",
          teacherId: teacher.id,
          subjectId: subject.id,
          students: { some: { studentId: students[0].id, status: "ACTIVE" } },
        },
      });
      if (dup) throw new UserError(`${students[0].name} already has an active ${subject.name} class with ${teacher.name}.`);
    }

    const meet = input.meetLink ? await assertMeetLinkFree(tx, input.meetLink) : null;
    const title =
      input.title?.trim() ||
      (input.type === "ONE_TO_ONE" ? `${subject.name} — ${students[0].name}` : `${subject.name}${input.grade ? ` — ${input.grade}` : ""} group`);

    const course = await tx.course.create({
      data: {
        orgId,
        title,
        type: input.type,
        subjectId: subject.id,
        teacherId: teacher.id,
        grade: input.grade || null,
        board: input.board || null,
        timezone: input.timezone,
        meetMode: "MANUAL",
        meetUrl: meet?.url,
        meetCode: meet?.code,
        createdById: actor.id,
        students: { create: students.map((s) => ({ studentId: s.id })) },
        threads: { create: { kind: "COURSE" } },
      },
    });

    if (input.schedule) {
      const s = await tx.schedule.create({
        data: {
          courseId: course.id,
          weekdays: input.schedule.weekdays,
          startTime: input.schedule.startTime,
          durationMin: input.schedule.durationMin,
          timezone: input.schedule.timezone,
          validFrom: dateOnly(input.schedule.validFrom),
          validUntil: input.schedule.validUntil ? dateOnly(input.schedule.validUntil) : null,
        },
      });
      await generateSessions(s.id, new Date(), tx);
    }
    return course;
  });

  await audit({ orgId, actorId: actor.id, action: "CLASS_CREATED", targetType: "Course", targetId: course.id, metadata: { title: course.title } });
  await notify([input.teacherId, ...input.studentIds], {
    title: "New class added",
    body: `${course.title} has been added to your Silora classes.`,
    link: "/classes/" + course.id,
    dedupeKey: `course_created:${course.id}`,
  }, { email: true });
  return course;
}

export async function addSchedule(actor: CurrentUser, courseId: string, input: ScheduleInput) {
  validateSchedule(input);
  const course = await activeCourse(actor, courseId);
  const s = await db.schedule.create({
    data: {
      courseId: course.id,
      weekdays: input.weekdays,
      startTime: input.startTime,
      durationMin: input.durationMin,
      timezone: input.timezone,
      validFrom: dateOnly(input.validFrom),
      validUntil: input.validUntil ? dateOnly(input.validUntil) : null,
    },
  });
  const count = await generateSessions(s.id);
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "SCHEDULE_ADDED", targetType: "Course", targetId: course.id, metadata: { scheduleId: s.id, lessons: count } });
  await notifyParticipants(course.id, {
    title: "Class schedule updated",
    body: `New lesson times were added for ${course.title}.`,
    link: "/classes/" + course.id,
  });
  return count;
}

/** Stop a recurring schedule: future lessons from it are removed (past ones are kept). */
export async function stopSchedule(actor: CurrentUser, scheduleId: string) {
  const schedule = await db.schedule.findFirst({ where: { id: scheduleId, course: { orgId: actor.orgId } }, include: { course: true } });
  if (!schedule) throw new UserError("Schedule not found.");
  const now = new Date();
  await db.$transaction([
    db.schedule.update({ where: { id: scheduleId }, data: { active: false, validUntil: dateOnly(localDateKey(now, schedule.timezone)) } }),
    db.classSession.deleteMany({ where: { scheduleId, startsAt: { gt: now }, status: "SCHEDULED", attendance: { none: {} } } }),
  ]);
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "SCHEDULE_STOPPED", targetType: "Course", targetId: schedule.courseId, metadata: { scheduleId } });
  await notifyParticipants(schedule.courseId, {
    title: "Class schedule updated",
    body: `Upcoming lesson times changed for ${schedule.course.title}.`,
    link: "/classes/" + schedule.courseId,
  });
}

export async function addOneOffSession(actor: CurrentUser, courseId: string, startsAt: Date, durationMin: number) {
  const course = await activeCourse(actor, courseId);
  if (durationMin < 15 || durationMin > 300) throw new UserError("Duration must be between 15 and 300 minutes.");
  if (startsAt.getTime() < Date.now() - 60_000) throw new UserError("Choose a time in the future.");
  const s = await db.classSession.create({
    data: { orgId: actor.orgId, courseId, startsAt, endsAt: new Date(startsAt.getTime() + durationMin * 60_000) },
  });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "SESSION_CREATED", targetType: "ClassSession", targetId: s.id });
  await notifyParticipants(course.id, {
    title: "Extra lesson scheduled",
    body: `An extra ${course.title} lesson was scheduled for ${fmtDateTime(startsAt, course.timezone)}.`,
    link: "/classes/" + course.id,
  });
  return s;
}

export async function cancelSession(actor: CurrentUser, sessionId: string, reason: string) {
  const s = await db.classSession.findFirst({ where: { id: sessionId, orgId: actor.orgId }, include: { course: true } });
  if (!s) throw new UserError("Lesson not found.");
  if (s.status !== "SCHEDULED") throw new UserError("Only scheduled lessons can be cancelled.");
  await db.classSession.update({ where: { id: s.id }, data: { status: "CANCELLED", cancelReason: reason || null } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "SESSION_CANCELLED", targetType: "ClassSession", targetId: s.id, metadata: { reason } });
  await notifyParticipants(s.courseId, {
    title: "Lesson cancelled",
    body: `Your ${s.course.title} lesson on ${fmtDateTime(s.startsAt, s.course.timezone)} has been cancelled.${reason ? ` Reason: ${reason}.` : ""}`,
    link: "/classes/" + s.courseId,
    dedupeKey: `cancelled:${s.id}`,
  });
}

export async function rescheduleSession(actor: CurrentUser, sessionId: string, startsAt: Date, durationMin: number) {
  const s = await db.classSession.findFirst({ where: { id: sessionId, orgId: actor.orgId }, include: { course: true } });
  if (!s) throw new UserError("Lesson not found.");
  if (s.status !== "SCHEDULED") throw new UserError("Only scheduled lessons can be rescheduled.");
  if (startsAt.getTime() < Date.now() - 60_000) throw new UserError("Choose a time in the future.");
  if (durationMin < 15 || durationMin > 300) throw new UserError("Duration must be between 15 and 300 minutes.");
  await db.classSession.update({
    where: { id: s.id },
    data: {
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMin * 60_000),
      originalStartsAt: s.originalStartsAt ?? s.startsAt,
    },
  });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "SESSION_RESCHEDULED", targetType: "ClassSession", targetId: s.id, metadata: { from: s.startsAt, to: startsAt } });
  await notifyParticipants(s.courseId, {
    title: "Lesson rescheduled",
    body: `Your ${s.course.title} lesson moved from ${fmtDateTime(s.startsAt, s.course.timezone)} to ${fmtDateTime(startsAt, s.course.timezone)}.`,
    link: "/classes/" + s.courseId,
  });
}

export async function updateMeetLink(actor: CurrentUser, courseId: string, link: string) {
  const course = await activeCourse(actor, courseId);
  const meet = await assertMeetLinkFree(db, link, course.id);
  await db.course.update({ where: { id: course.id }, data: { meetUrl: meet.url, meetCode: meet.code, meetMode: "MANUAL" } });
  await audit({
    orgId: actor.orgId,
    actorId: actor.id,
    action: "MEET_LINK_SET",
    targetType: "Course",
    targetId: course.id,
    metadata: { from: course.meetCode, to: meet.code },
  });
}

/** End a relationship: future lessons cancelled, chat becomes read-only. */
export async function endCourse(actor: CurrentUser, courseId: string, reason: string) {
  const course = await activeCourse(actor, courseId);
  const now = new Date();
  await db.$transaction([
    db.course.update({ where: { id: course.id }, data: { status: "ENDED", endedAt: now, endedReason: reason || null } }),
    db.schedule.updateMany({ where: { courseId: course.id }, data: { active: false } }),
    db.classSession.updateMany({
      where: { courseId: course.id, status: "SCHEDULED", startsAt: { gt: now } },
      data: { status: "CANCELLED", cancelReason: "Class ended" },
    }),
    db.thread.updateMany({ where: { courseId: course.id }, data: { status: "READ_ONLY" } }),
  ]);
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "CLASS_ENDED", targetType: "Course", targetId: course.id, metadata: { reason } });
  await notifyParticipants(course.id, {
    title: "Class ended",
    body: `${course.title} has ended. Contact Silora if you have questions.`,
    link: "/classes/" + course.id,
  });
}

/**
 * Teacher replacement creates a NEW relationship (new teacher ⇒ new Meet link,
 * new chat). The old one is ended so the previous teacher loses access.
 */
export async function replaceTeacher(actor: CurrentUser, courseId: string, newTeacherId: string, meetLink: string | null) {
  const course = await db.course.findFirst({
    where: { id: courseId, orgId: actor.orgId, status: "ACTIVE" },
    include: { subject: true, students: { where: { status: "ACTIVE" } }, schedules: { where: { active: true } } },
  });
  if (!course) throw new UserError("Active class not found.");
  if (course.teacherId === newTeacherId) throw new UserError("That teacher already teaches this class.");

  const today = localDateKey(new Date(), course.timezone);
  const firstSchedule = course.schedules[0];
  const created = await createCourse(actor, {
    type: course.type,
    subjectName: course.subject.name,
    teacherId: newTeacherId,
    studentIds: course.students.map((s) => s.studentId),
    grade: course.grade,
    board: course.board,
    timezone: course.timezone,
    meetLink,
    schedule: firstSchedule
      ? {
          weekdays: firstSchedule.weekdays,
          startTime: firstSchedule.startTime,
          durationMin: firstSchedule.durationMin,
          timezone: firstSchedule.timezone,
          validFrom: today,
          validUntil: firstSchedule.validUntil ? firstSchedule.validUntil.toISOString().slice(0, 10) : null,
        }
      : null,
  });
  for (const extra of course.schedules.slice(1)) {
    await addSchedule(actor, created.id, {
      weekdays: extra.weekdays,
      startTime: extra.startTime,
      durationMin: extra.durationMin,
      timezone: extra.timezone,
      validFrom: today,
      validUntil: extra.validUntil ? extra.validUntil.toISOString().slice(0, 10) : null,
    });
  }
  await endCourse(actor, course.id, "Teacher replaced");
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "TEACHER_REPLACED", targetType: "Course", targetId: course.id, metadata: { newCourseId: created.id, newTeacherId } });
  return created;
}

export async function addStudentToGroup(actor: CurrentUser, courseId: string, studentId: string) {
  const course = await activeCourse(actor, courseId);
  if (course.type !== "GROUP") throw new UserError("Students can only be added to group classes.");
  await assertStudents(db, actor.orgId, [studentId]);
  await db.courseStudent.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    update: { status: "ACTIVE", removedAt: null },
    create: { courseId, studentId },
  });
  await db.thread.updateMany({ where: { courseId, studentId, kind: "PRIVATE" }, data: { status: "ACTIVE" } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "STUDENT_ADDED", targetType: "Course", targetId: courseId, metadata: { studentId } });
  await notify([studentId], { title: "New class added", body: `You were added to ${course.title}.`, link: "/classes/" + courseId }, { email: true });
}

export async function removeStudentFromGroup(actor: CurrentUser, courseId: string, studentId: string) {
  const course = await activeCourse(actor, courseId);
  if (course.type !== "GROUP") throw new UserError("To remove the student from a one-to-one class, end the class instead.");
  await db.$transaction([
    db.courseStudent.update({
      where: { courseId_studentId: { courseId, studentId } },
      data: { status: "REMOVED", removedAt: new Date() },
    }),
    db.thread.updateMany({ where: { courseId, studentId, kind: "PRIVATE" }, data: { status: "DISABLED" } }),
  ]);
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "STUDENT_REMOVED", targetType: "Course", targetId: courseId, metadata: { studentId } });
}

export async function setChatEnabled(actor: CurrentUser, courseId: string, enabled: boolean) {
  const course = await db.course.findFirst({ where: { id: courseId, orgId: actor.orgId } });
  if (!course) throw new UserError("Class not found.");
  await db.course.update({ where: { id: courseId }, data: { chatEnabled: enabled } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: enabled ? "CHAT_ENABLED" : "CHAT_DISABLED", targetType: "Course", targetId: courseId });
}

/* ---------- helpers ---------- */

async function activeCourse(actor: CurrentUser, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, orgId: actor.orgId } });
  if (!course) throw new UserError("Class not found.");
  if (course.status !== "ACTIVE") throw new UserError("This class has ended.");
  return course;
}

export async function participantIds(courseId: string) {
  const c = await db.course.findUnique({
    where: { id: courseId },
    select: { teacherId: true, students: { where: { status: "ACTIVE" }, select: { studentId: true } } },
  });
  if (!c) return [];
  return [c.teacherId, ...c.students.map((s) => s.studentId)];
}

/** Every participant notification is a class change or cancellation, so it is emailed too. */
async function notifyParticipants(courseId: string, n: { title: string; body: string; link?: string; dedupeKey?: string }) {
  await notify(await participantIds(courseId), n, { email: true });
}
