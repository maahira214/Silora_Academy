import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/authz";
import { STATUS_META } from "@/lib/session-status";
import { fmtDate, fmtTime, localDateKey, localDayRange, tzLabel } from "@/lib/time";
import { loadSessions, studentNames, type SessionRow } from "@/server/sessions";
import { AutoRefresh } from "@/components/auto-refresh";
import { SessionTable } from "@/components/session-table";
import { AlertList } from "@/components/alert-list";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, CardHeader, PageHeader, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

const ATTENTION = new Set(["TEACHER_NOT_JOINED", "STUDENT_NOT_JOINED", "NO_ONE_JOINED"]);
const IN_PROGRESS = new Set(["LIVE", "TEACHER_NOT_JOINED", "STUDENT_NOT_JOINED", "NO_ONE_JOINED", "OPEN"]);

export default async function AdminDashboard() {
  const user = await requirePageUser("SUPER_ADMIN", "OPERATIONS");
  const org = user.org;
  const tz = user.timezone ?? org.timezone;
  const now = new Date();
  const [dayStart, dayEnd] = localDayRange(localDateKey(now, tz), tz);

  const [today, alerts] = await Promise.all([
    loadSessions({ startsAt: { gte: dayStart, lt: dayEnd } }, org),
    db.alert.findMany({ where: { orgId: org.id, status: { not: "RESOLVED" } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: 20 }),
  ]);

  const active = today.filter((s) => s.status !== "CANCELLED");
  const attention = active.filter((s) => ATTENTION.has(s.live));
  const inProgress = active.filter((s) => IN_PROGRESS.has(s.live));
  const upcoming = active.filter((s) => s.live === "SCHEDULED" || s.live === "UPCOMING");
  const finished = active.filter((s) => s.status !== "SCHEDULED" || s.live === "ENDED_PENDING");
  // Lessons that are late already show above as lessons, so their monitor alerts would only repeat them.
  const lateSessionIds = new Set(attention.map((s) => s.id));
  const otherAlerts = alerts.filter((a) => !(a.sessionId && lateSessionIds.has(a.sessionId) && a.status === "OPEN"));
  const problems = attention.length + otherAlerts.length;

  // Staff can phone people straight from a late lesson.
  const phoneIds = attention.flatMap((s) => [s.course.teacherId, ...s.course.students.map((cs) => cs.studentId)]);
  const phones = new Map(
    (await db.user.findMany({ where: { id: { in: phoneIds }, phone: { not: null } }, select: { id: true, phone: true } })).map((u) => [u.id, u.phone!]),
  );

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Today"
        subtitle={`${fmtDate(now, tz)} · times in ${tzLabel(now, tz)} · updates by itself`}
        actions={
          <>
            <ButtonLink href="/admin/sessions" variant="secondary">
              Full schedule
            </ButtonLink>
            <ButtonLink href="/admin/classes/new">+ New class</ButtonLink>
          </>
        }
      />

      {/* 1. Problems first */}
      {problems === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900 ring-1 ring-emerald-200">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-lg">✓</span>
          <div>
            <p className="font-bold">All clear</p>
            <p className="text-sm">Nothing needs you right now. This page checks again every 30 seconds.</p>
          </div>
        </div>
      ) : (
        <Card className="ring-2 ring-red-200">
          <CardHeader
            title={<span className="text-red-800">Needs attention now ({problems})</span>}
            subtitle="Late joiners first, then alerts. Resolve each one when it's handled."
          />
          {attention.length > 0 && (
            <ul className="divide-y divide-slate-100 border-b border-slate-100">
              {attention.map((s) => (
                <LateLesson key={s.id} s={s} timeZone={tz} phones={phones} />
              ))}
            </ul>
          )}
          {otherAlerts.length > 0 && <AlertList alerts={otherAlerts} timeZone={tz} compact />}
        </Card>
      )}

      {/* 2. Numbers in one row */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-4">
        <Count label="Classes today" value={active.length} />
        <Count label="In progress" value={inProgress.length} tone={inProgress.length ? "success" : undefined} />
        <Count label="Still to come" value={upcoming.length} />
        <Count label="Finished" value={finished.length} />
      </div>

      {/* 3. Everything else, one click deeper */}
      <Card className="mt-6">
        <CardHeader title="Happening now" subtitle="Open to join or in progress" />
        <SessionTable sessions={inProgress} timeZone={tz} empty="No lessons are in progress right now." />
      </Card>
      <Card className="mt-6">
        <CardHeader title="Later today" subtitle={upcoming[0] ? `Next lesson at ${fmtTime(upcoming[0].startsAt, tz)}` : undefined} />
        <SessionTable sessions={upcoming} timeZone={tz} empty="No more lessons today." />
      </Card>
    </>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="bg-white px-5 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx("text-2xl font-bold tabular-nums", tone === "success" ? "text-emerald-700" : "text-navy-900")}>{value}</div>
    </div>
  );
}

/** A lesson where someone hasn't joined after the grace period, with call buttons. */
function LateLesson({ s, timeZone, phones }: { s: SessionRow; timeZone: string; phones: Map<string, string> }) {
  const meta = STATUS_META[s.live];
  const callTeacher = s.live !== "STUDENT_NOT_JOINED" && phones.get(s.course.teacherId);
  const missingStudents = s.live === "TEACHER_NOT_JOINED" ? [] : s.course.students.filter((cs) => phones.has(cs.studentId));
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-sm font-semibold text-slate-700">Started {fmtTime(s.startsAt, timeZone)}</span>
        </div>
        <p className="mt-1 font-semibold text-navy-900">{s.course.subject.name}</p>
        <p className="text-sm text-slate-600">
          Teacher {s.course.teacher.name} · {s.course.type === "GROUP" ? "Group" : "Student"} {studentNames(s)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {callTeacher && (
          <a href={`tel:${callTeacher}`} className={buttonClass("primary", "md")}>
            <Icon name="phone" className="size-4" /> Call teacher
          </a>
        )}
        {missingStudents.slice(0, 3).map((cs) => (
          <a key={cs.studentId} href={`tel:${phones.get(cs.studentId)}`} className={buttonClass("primary", "md")}>
            <Icon name="phone" className="size-4" /> Call {s.course.type === "GROUP" ? cs.student.name.split(" ")[0] : "student"}
          </a>
        ))}
        <Link href={`/admin/sessions/${s.id}`} className={buttonClass("secondary", "md")}>
          Open lesson
        </Link>
      </div>
    </li>
  );
}
