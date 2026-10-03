import Link from "next/link";
import { joinWindow } from "@/lib/session-status";
import { fmt, fmtTime } from "@/lib/time";
import type { SessionRow } from "@/server/sessions";
import { StatusBadge } from "@/components/session-table";
import { Icon } from "@/components/icons";
import { Badge, buttonClass, cx } from "@/components/ui";

/** A lesson as a teacher or student sees it, with the Join Class button. */
export function LessonCard({
  s,
  viewer,
  timeZone,
  joinOpensMinutesBefore,
  showDate,
  base,
}: {
  s: SessionRow;
  viewer: "TEACHER" | "STUDENT";
  timeZone: string;
  joinOpensMinutesBefore: number;
  showDate?: boolean;
  base: "/teacher" | "/student";
}) {
  const now = new Date();
  const w = joinWindow(s, joinOpensMinutesBefore, now);
  const counterpart =
    viewer === "TEACHER"
      ? s.course.students.map((cs) => cs.student.name).join(", ")
      : s.course.teacher.name;
  const opensAt = new Date(s.startsAt.getTime() - joinOpensMinutesBefore * 60_000);
  const joined = viewer === "TEACHER" ? s.teacherJoined : s.studentsJoined > 0;

  return (
    <div
      className={cx(
        "flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 sm:flex-row sm:items-center sm:p-5",
        w === "open" ? "ring-gold-400" : "ring-slate-200",
        s.status === "CANCELLED" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-4 sm:w-40 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0">
        {showDate && <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fmt(s.startsAt, timeZone, "EEE, d MMM")}</span>}
        <span className="text-2xl font-bold text-navy-900 tabular-nums">{fmtTime(s.startsAt, timeZone)}</span>
        <span className="text-xs text-slate-500">until {fmtTime(s.endsAt, timeZone)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`${base}/classes/${s.courseId}`} className="text-lg font-bold text-navy-900 hover:underline">
          {s.course.subject.name}
        </Link>
        <p className="text-sm text-slate-600">
          {viewer === "TEACHER" ? (s.course.type === "GROUP" ? "Group: " : "Student: ") : "Teacher: "}
          <span className="font-semibold text-slate-800">{counterpart}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {s.live === "TEACHER_NOT_JOINED" || s.live === "STUDENT_NOT_JOINED" || s.live === "NO_ONE_JOINED" ? (
            // Ops-facing alert states become plain language for participants
            <Badge tone="brand">
              {viewer === "STUDENT" && s.live !== "NO_ONE_JOINED" && !s.teacherJoined
                ? "Waiting for teacher"
                : viewer === "TEACHER" && s.studentsJoined === 0
                  ? "Waiting for student"
                  : "In progress"}
            </Badge>
          ) : (
            <StatusBadge status={s.live} />
          )}
          {s.originalStartsAt && <span className="text-xs font-semibold text-orange-700">Rescheduled</span>}
          {joined && w === "open" && <span className="text-xs font-semibold text-emerald-700">You joined</span>}
        </div>
      </div>
      <div className="sm:shrink-0">
        {w === "open" ? (
          <a href={`/join/${s.id}`} target="_blank" rel="noreferrer" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
            <Icon name="video" />
            {joined ? "Rejoin class" : "Join class"}
          </a>
        ) : w === "not_yet" ? (
          <span className={buttonClass("secondary", "md", "w-full cursor-default opacity-70 sm:w-auto")}>Opens {fmtTime(opensAt, timeZone)}</span>
        ) : w === "cancelled" ? (
          <span className="text-sm font-semibold text-slate-500">Cancelled</span>
        ) : null}
      </div>
    </div>
  );
}
