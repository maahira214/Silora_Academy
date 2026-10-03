import type { SessionStatus } from "@prisma/client";

/**
 * A lesson's live status is derived from time + who has joined. Only final
 * outcomes (COMPLETED, CANCELLED, absences…) are stored; the monitor worker
 * writes them once a lesson ends.
 */

export type LiveStatus =
  | "SCHEDULED"
  | "UPCOMING"
  | "OPEN"
  | "LIVE"
  | "TEACHER_NOT_JOINED"
  | "STUDENT_NOT_JOINED"
  | "NO_ONE_JOINED"
  | "ENDED_PENDING"
  | SessionStatus;

export type StatusInput = {
  status: SessionStatus;
  startsAt: Date;
  endsAt: Date;
  teacherJoined: boolean;
  studentsJoined: number;
  studentsExpected: number;
};

export type StatusSettings = {
  joinOpensMinutesBefore: number;
  teacherGraceMinutes: number;
  studentGraceMinutes: number;
};

const UPCOMING_WINDOW_MIN = 60;

export function deriveStatus(s: StatusInput, cfg: StatusSettings, now: Date): LiveStatus {
  if (s.status !== "SCHEDULED") return s.status;

  const t = now.getTime();
  const start = s.startsAt.getTime();
  const end = s.endsAt.getTime();
  const opens = start - cfg.joinOpensMinutesBefore * 60_000;

  if (t >= end) return "ENDED_PENDING";
  if (t < start - UPCOMING_WINDOW_MIN * 60_000) return "SCHEDULED";
  if (t < opens) return "UPCOMING";

  const anyStudent = s.studentsJoined > 0;
  const teacherLate = t >= start + cfg.teacherGraceMinutes * 60_000;
  const studentLate = t >= start + cfg.studentGraceMinutes * 60_000;

  if (!s.teacherJoined && !anyStudent && teacherLate) return "NO_ONE_JOINED";
  if (!s.teacherJoined && teacherLate) return "TEACHER_NOT_JOINED";
  if (s.teacherJoined && !anyStudent && studentLate && s.studentsExpected > 0) return "STUDENT_NOT_JOINED";
  if (s.teacherJoined || anyStudent) return t >= start ? "LIVE" : "OPEN";
  return "OPEN";
}

/** Final outcome to store once a lesson has ended. */
export function finalOutcome(s: StatusInput): SessionStatus {
  if (s.status !== "SCHEDULED") return s.status;
  if (!s.teacherJoined && s.studentsJoined === 0) return "NO_SHOW";
  if (!s.teacherJoined) return "TEACHER_ABSENT";
  if (s.studentsJoined === 0 && s.studentsExpected > 0) return "STUDENT_ABSENT";
  return "COMPLETED";
}

/** Whether the Join Class button may be used right now. */
export function joinWindow(s: { status: SessionStatus; startsAt: Date; endsAt: Date }, joinOpensMinutesBefore: number, now: Date) {
  if (s.status === "CANCELLED") return "cancelled" as const;
  const opens = s.startsAt.getTime() - joinOpensMinutesBefore * 60_000;
  if (now.getTime() < opens) return "not_yet" as const;
  if (now.getTime() >= s.endsAt.getTime()) return "ended" as const;
  return "open" as const;
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export const STATUS_META: Record<LiveStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: "Scheduled", tone: "neutral" },
  UPCOMING: { label: "Upcoming", tone: "info" },
  OPEN: { label: "Open to join", tone: "brand" },
  LIVE: { label: "Live", tone: "success" },
  TEACHER_NOT_JOINED: { label: "Teacher not joined", tone: "danger" },
  STUDENT_NOT_JOINED: { label: "Student not joined", tone: "warning" },
  NO_ONE_JOINED: { label: "No one joined", tone: "danger" },
  ENDED_PENDING: { label: "Ended", tone: "neutral" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  TEACHER_ABSENT: { label: "Teacher absent", tone: "danger" },
  STUDENT_ABSENT: { label: "Student absent", tone: "warning" },
  NO_SHOW: { label: "No show", tone: "danger" },
  TECHNICAL_ISSUE: { label: "Technical issue", tone: "warning" },
};
