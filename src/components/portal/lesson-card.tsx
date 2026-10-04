import Link from "next/link";
import { fmt, fmtTime } from "@/lib/time";
import type { SessionRow } from "@/server/sessions";
import { Icon } from "@/components/icons";
import { LessonLive } from "@/components/portal/lesson-live";
import { buttonClass, cx } from "@/components/ui";

type Viewer = "TEACHER" | "STUDENT";

const counterpartOf = (s: SessionRow, viewer: Viewer) =>
  viewer === "TEACHER" ? s.course.students.map((cs) => cs.student.name).join(", ") : s.course.teacher.name;

/** Plain-language "waiting" line while the other side hasn't joined yet. */
function waitingFor(s: SessionRow, viewer: Viewer) {
  if (viewer === "STUDENT" && !s.teacherJoined) return "Waiting for your teacher";
  if (viewer === "TEACHER" && s.studentsJoined === 0) return s.course.type === "GROUP" ? "Waiting for students" : "Waiting for your student";
  return undefined;
}

function liveProps(s: SessionRow, viewer: Viewer, timeZone: string, joinOpensMinutesBefore: number) {
  return {
    sessionId: s.id,
    status: s.status,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    joinOpensMinutesBefore,
    startTime: fmtTime(s.startsAt, timeZone),
    serverNow: new Date().toISOString(),
    joined: viewer === "TEACHER" ? s.teacherJoined : s.studentsJoined > 0,
    waitingFor: waitingFor(s, viewer),
  };
}

/** A lesson as a teacher or student sees it, with the Join class button. */
export function LessonCard({
  s,
  viewer,
  timeZone,
  joinOpensMinutesBefore,
  showDate,
  base,
  messageHref,
}: {
  s: SessionRow;
  viewer: Viewer;
  timeZone: string;
  joinOpensMinutesBefore: number;
  showDate?: boolean;
  base: "/teacher" | "/student";
  messageHref?: string;
}) {
  return (
    <div className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5", s.status === "CANCELLED" && "opacity-60")}>
      <div className="flex items-start gap-4">
        <div className="w-20 shrink-0">
          {showDate && <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fmt(s.startsAt, timeZone, "EEE d MMM")}</div>}
          <div className="text-xl font-bold text-navy-900 tabular-nums">{fmtTime(s.startsAt, timeZone)}</div>
          <div className="text-xs text-slate-500">to {fmtTime(s.endsAt, timeZone)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`${base}/classes/${s.courseId}`} className="text-lg font-bold text-navy-900 hover:underline">
            {s.course.subject.name}
          </Link>
          <p className="truncate text-sm text-slate-600">
            {viewer === "TEACHER" ? "with " : "Teacher: "}
            <span className="font-semibold text-slate-800">{counterpartOf(s, viewer)}</span>
          </p>
          {s.originalStartsAt && <p className="text-xs font-semibold text-orange-700">New time</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <LessonLive {...liveProps(s, viewer, timeZone, joinOpensMinutesBefore)} />
        {messageHref && (
          <Link href={messageHref} className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
            <Icon name="chat" /> Message
          </Link>
        )}
      </div>
    </div>
  );
}

/** The big "Your next class" card at the top of the student and teacher home screen. */
export function NextClassCard({
  s,
  viewer,
  timeZone,
  joinOpensMinutesBefore,
  base,
  messageHref,
  today,
}: {
  s: SessionRow;
  viewer: Viewer;
  timeZone: string;
  joinOpensMinutesBefore: number;
  base: "/teacher" | "/student";
  messageHref?: string;
  today: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-navy-800 text-white shadow-lg">
      <div className="p-5 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wider text-gold-400">Your next class</p>
        <Link href={`${base}/classes/${s.courseId}`} className="mt-2 block text-3xl font-bold hover:underline">
          {s.course.subject.name}
        </Link>
        <p className="mt-1 text-navy-100">
          {viewer === "TEACHER" ? "with " : "Teacher: "}
          <span className="font-semibold text-white">{counterpartOf(s, viewer)}</span>
        </p>
        <p className="mt-3 text-lg font-semibold">
          {today ? "Today" : fmt(s.startsAt, timeZone, "EEEE d MMMM")}, {fmtTime(s.startsAt, timeZone)} to {fmtTime(s.endsAt, timeZone)}
        </p>
      </div>
      <div className="space-y-3 bg-white p-5 sm:p-7">
        <LessonLive {...liveProps(s, viewer, timeZone, joinOpensMinutesBefore)} hero />
        {messageHref && (
          <Link href={messageHref} className={buttonClass("secondary", "lg", "w-full")}>
            <Icon name="chat" /> Message {viewer === "TEACHER" ? (s.course.type === "GROUP" ? "the class" : "your student") : "your teacher"}
          </Link>
        )}
      </div>
    </section>
  );
}
