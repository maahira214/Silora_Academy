import "server-only";
import type { Organization, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deriveStatus, type LiveStatus } from "@/lib/session-status";

/** Lessons with everything a dashboard row needs, plus their derived live status. */
export const sessionInclude = {
  course: {
    include: {
      subject: true,
      teacher: { select: { id: true, name: true } },
      students: { where: { status: "ACTIVE" as const }, include: { student: { select: { id: true, name: true } } } },
    },
  },
  attendance: true,
} satisfies Prisma.ClassSessionInclude;

export type SessionRow = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }> & {
  live: LiveStatus;
  teacherJoined: boolean;
  studentsJoined: number;
};

export function withLiveStatus(
  sessions: Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>[],
  org: Pick<Organization, "joinOpensMinutesBefore" | "teacherGraceMinutes" | "studentGraceMinutes">,
  now = new Date(),
): SessionRow[] {
  return sessions.map((s) => {
    const joined = new Set(s.attendance.filter((a) => a.firstJoinAt || a.meetJoinedAt).map((a) => a.userId));
    const teacherJoined = joined.has(s.course.teacherId);
    const studentsJoined = s.course.students.filter((cs) => joined.has(cs.studentId)).length;
    return {
      ...s,
      teacherJoined,
      studentsJoined,
      live: deriveStatus(
        { status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, teacherJoined, studentsJoined, studentsExpected: s.course.students.length },
        org,
        now,
      ),
    };
  });
}

export async function loadSessions(
  where: Prisma.ClassSessionWhereInput,
  org: Organization,
  opts: { take?: number; order?: "asc" | "desc" } = {},
) {
  const rows = await db.classSession.findMany({
    where: { ...where, orgId: org.id },
    include: sessionInclude,
    orderBy: { startsAt: opts.order ?? "asc" },
    take: opts.take,
  });
  return withLiveStatus(rows, org);
}

export const studentNames = (s: SessionRow) => s.course.students.map((cs) => cs.student.name).join(", ") || "—";
