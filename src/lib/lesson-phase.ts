import type { SessionStatus } from "@prisma/client";

/**
 * How a lesson looks to a teacher or student, in plain words. Staff screens use the
 * detailed monitoring statuses in session-status.ts instead.
 *
 *   later        more than an hour away            "Starts at 6:00 PM"
 *   soon         within the hour, not open yet     "Starts in 8 min"
 *   open         Join button is open               "Join now"
 *   in_progress  past the start time               "Class in progress"
 *   finished     past the end time                 "Finished"
 *   cancelled                                      "Cancelled"
 */
export type LessonPhase = "later" | "soon" | "open" | "in_progress" | "finished" | "cancelled";

const SOON_MS = 60 * 60_000;

export function lessonPhase(
  s: { status: SessionStatus; startsAt: Date; endsAt: Date },
  joinOpensMinutesBefore: number,
  now: Date,
): LessonPhase {
  if (s.status === "CANCELLED") return "cancelled";
  const t = now.getTime();
  if (t >= s.endsAt.getTime() || s.status !== "SCHEDULED") return "finished";
  if (t >= s.startsAt.getTime()) return "in_progress";
  if (t >= s.startsAt.getTime() - joinOpensMinutesBefore * 60_000) return "open";
  if (t >= s.startsAt.getTime() - SOON_MS) return "soon";
  return "later";
}

/** Join is allowed while the lesson is open or in progress (the server checks again on /join). */
export const canJoin = (phase: LessonPhase) => phase === "open" || phase === "in_progress";

/** "8 min", "1 hr 5 min", "less than a minute". Rounds up so it never says "0 min" early. */
export function durationText(ms: number) {
  if (ms < 60_000) return "less than a minute";
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** The short status line shown on a lesson. `startTime` is the already-formatted local start time. */
export function phaseLabel(phase: LessonPhase, startsAt: Date, now: Date, startTime: string) {
  switch (phase) {
    case "later":
      return `Starts at ${startTime}`;
    case "soon":
      return `Starts in ${durationText(startsAt.getTime() - now.getTime())}`;
    case "open":
      return "Join now";
    case "in_progress":
      return "Class in progress";
    case "finished":
      return "Finished";
    case "cancelled":
      return "Cancelled";
  }
}

/** What happened in a past lesson, in plain words for teachers and students. */
export function pastLessonLabel(status: SessionStatus, viewer: "TEACHER" | "STUDENT"): { label: string; tone: "success" | "neutral" | "warning" } {
  switch (status) {
    case "COMPLETED":
    case "SCHEDULED": // ended, outcome not written yet
      return { label: "Finished", tone: "success" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    case "TEACHER_ABSENT":
      return { label: viewer === "TEACHER" ? "You didn't join" : "Teacher didn't join", tone: "warning" };
    case "STUDENT_ABSENT":
      return { label: viewer === "STUDENT" ? "You didn't join" : "Student didn't join", tone: "warning" };
    case "NO_SHOW":
      return { label: "Nobody joined", tone: "warning" };
    case "TECHNICAL_ISSUE":
      return { label: "Technical problem", tone: "warning" };
  }
}
