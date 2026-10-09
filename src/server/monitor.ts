import "server-only";
import type { AlertSeverity } from "@prisma/client";
import { db } from "@/lib/db";
import { finalOutcome } from "@/lib/session-status";
import { fmtTime } from "@/lib/time";
import { generateSessions } from "@/server/courses";
import { deliverPendingEmails } from "@/server/email";
import { notify } from "@/server/notifications";
import { sessionInclude, studentNames, withLiveStatus } from "@/server/sessions";

/**
 * One pass of the class monitor. Run every minute (npm run worker, or a
 * Cloud Scheduler call to /api/cron/tick). Every step is idempotent via
 * dedupe keys, so overlapping or repeated runs are harmless — important at
 * peak times when many classes start at once.
 */
export async function runMonitorTick(now = new Date(), opts: { extendSchedules?: boolean } = {}) {
  const stats = { reminders: 0, alerts: 0, finalized: 0, generated: 0, emails: 0 };
  const orgs = await db.organization.findMany();

  for (const org of orgs) {
    const maxReminder = Math.max(0, ...org.reminderMinutesBefore);
    const rows = await db.classSession.findMany({
      where: {
        orgId: org.id,
        status: "SCHEDULED",
        startsAt: { lte: new Date(now.getTime() + (maxReminder + 1) * 60_000) },
        endsAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        course: { status: "ACTIVE" },
      },
      include: sessionInclude,
    });
    const sessions = withLiveStatus(rows, org, now);

    for (const s of sessions) {
      const participants = [s.course.teacherId, ...s.course.students.map((cs) => cs.studentId)];
      const tz = s.course.timezone;
      const minsToStart = (s.startsAt.getTime() - now.getTime()) / 60_000;

      // Reminders (generic wording; the link opens the Silora join page, not the raw Meet link)
      for (const m of org.reminderMinutesBefore) {
        if (minsToStart <= m && minsToStart > 0) {
          await notify(participants, {
            title: m <= org.joinOpensMinutesBefore ? `Class starts in ${m} minutes — join now` : `Class starts in ${m} minutes`,
            body: `${s.course.subject.name} at ${fmtTime(s.startsAt, tz)}.`,
            link: `/join/${s.id}`,
            dedupeKey: `reminder:${s.id}:${m}`,
          });
          stats.reminders++;
        }
      }
      if (minsToStart <= 0 && s.live !== "ENDED_PENDING") {
        const absent = participants.filter((id) => !s.attendance.some((a) => a.userId === id && (a.firstJoinAt || a.meetJoinedAt)));
        await notify(absent, {
          title: "Your class is starting now",
          body: `${s.course.subject.name} started at ${fmtTime(s.startsAt, tz)}.`,
          link: `/join/${s.id}`,
          dedupeKey: `starting:${s.id}`,
        });
      }

      const who = `${s.course.title} · Teacher: ${s.course.teacher.name} · Student(s): ${studentNames(s)} · Start: ${fmtTime(s.startsAt, tz)}`;
      const raise = async (type: string, severity: AlertSeverity, title: string) => {
        const res = await db.alert.upsert({
          where: { dedupeKey: `${type}:${s.id}` },
          update: {},
          create: { orgId: org.id, courseId: s.courseId, sessionId: s.id, type, severity, title, details: who, dedupeKey: `${type}:${s.id}` },
        });
        if (res.createdAt.getTime() >= now.getTime() - 1000) stats.alerts++;
      };

      if (s.live === "NO_ONE_JOINED") await raise("NO_PARTICIPANTS", "CRITICAL", "No participants have joined");
      if (s.live === "TEACHER_NOT_JOINED") await raise("TEACHER_MISSING", "CRITICAL", "Teacher has not joined");
      if (s.live === "STUDENT_NOT_JOINED") {
        await raise("STUDENT_MISSING", "WARNING", "Student has not joined");
        await notify([s.course.teacherId], {
          title: "Your student hasn't joined yet",
          body: "Silora operations has been notified.",
          link: `/join/${s.id}`,
          dedupeKey: `student_missing:${s.id}`,
        });
      }

      // Lesson over → store the final outcome
      if (s.live === "ENDED_PENDING") {
        const outcome = finalOutcome({
          status: s.status,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          teacherJoined: s.teacherJoined,
          studentsJoined: s.studentsJoined,
          studentsExpected: s.course.students.length,
        });
        await db.classSession.update({ where: { id: s.id }, data: { status: outcome, completedAt: now } });
        if (outcome === "COMPLETED") {
          // Attendance problems that sorted themselves out
          await db.alert.updateMany({
            where: { sessionId: s.id, type: { in: ["TEACHER_MISSING", "STUDENT_MISSING", "NO_PARTICIPANTS"] }, status: "OPEN" },
            data: { status: "RESOLVED", resolvedAt: now },
          });
        }
        stats.finalized++;
      }
    }
  }

  if (opts.extendSchedules) {
    const schedules = await db.schedule.findMany({ where: { active: true, course: { status: "ACTIVE" } }, select: { id: true } });
    for (const sc of schedules) stats.generated += await generateSessions(sc.id, now);
  }

  // Email outbox: class changes queued since the last tick
  stats.emails = await deliverPendingEmails(now);
  return stats;
}

/** Called when someone joins: clears the matching "not joined" alert. */
export async function resolveJoinAlerts(sessionId: string, role: "TEACHER" | "STUDENT") {
  const types = role === "TEACHER" ? ["TEACHER_MISSING", "NO_PARTICIPANTS"] : ["STUDENT_MISSING", "NO_PARTICIPANTS"];
  await db.alert.updateMany({
    where: { sessionId, type: { in: types }, status: { not: "RESOLVED" } },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}
