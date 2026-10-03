import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { STATUS_META, type LiveStatus } from "@/lib/session-status";
import { addDaysToKey, fmtDate, localDateKey, localDayRange } from "@/lib/time";
import { loadSessions } from "@/server/sessions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Input, Select } from "@/components/forms";
import { SessionTable } from "@/components/session-table";
import { Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Schedule" };

const FILTER_STATUSES: LiveStatus[] = [
  "UPCOMING",
  "OPEN",
  "LIVE",
  "TEACHER_NOT_JOINED",
  "STUDENT_NOT_JOINED",
  "NO_ONE_JOINED",
  "COMPLETED",
  "CANCELLED",
  "TEACHER_ABSENT",
  "STUDENT_ABSENT",
  "NO_SHOW",
  "TECHNICAL_ISSUE",
];

export default async function SchedulePage({ searchParams }: PageProps<"/admin/sessions">) {
  const user = await requirePagePermission("people.view");
  const sp = await searchParams;
  const tz = user.timezone ?? user.org.timezone;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const date = /^\d{4}-\d{2}-\d{2}$/.test(s("date")) ? s("date") : localDateKey(new Date(), tz);
  const days = Math.min(Math.max(Number(s("days")) || 1, 1), 14);
  const [from] = localDayRange(date, tz);
  const [, to] = localDayRange(addDaysToKey(date, days - 1), tz);

  const where: Prisma.ClassSessionWhereInput = {
    startsAt: { gte: from, lt: to },
    course: {
      teacherId: s("teacher") || undefined,
      subjectId: s("subject") || undefined,
      type: s("type") === "GROUP" || s("type") === "ONE_TO_ONE" ? (s("type") as "GROUP" | "ONE_TO_ONE") : undefined,
      students: s("student") ? { some: { studentId: s("student") } } : undefined,
    },
  };
  const [all, teachers, students, subjects] = await Promise.all([
    loadSessions(where, user.org),
    db.user.findMany({ where: { orgId: user.orgId, role: "TEACHER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { orgId: user.orgId, role: "STUDENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.subject.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
  ]);
  const status = s("status") as LiveStatus | "";
  const sessions = status ? all.filter((x) => x.live === status) : all;

  const shift = (n: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    p.set("date", addDaysToKey(date, n));
    return `/admin/sessions?${p}`;
  };

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Schedule"
        subtitle={days === 1 ? fmtDate(from, tz) : `${fmtDate(from, tz)} → ${fmtDate(new Date(to.getTime() - 1), tz)}`}
        actions={
          <>
            <Link href={shift(-days)} className={buttonClass("secondary", "sm")}>
              ← Previous
            </Link>
            <Link href="/admin/sessions" className={buttonClass("secondary", "sm")}>
              Today
            </Link>
            <Link href={shift(days)} className={buttonClass("secondary", "sm")}>
              Next →
            </Link>
          </>
        }
      />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input type="date" name="date" defaultValue={date} className="sm:max-w-[170px]" />
        <Select name="days" defaultValue={String(days)} className="sm:max-w-[120px]">
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
        </Select>
        <Select name="teacher" defaultValue={s("teacher")} className="sm:max-w-[180px]">
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select name="student" defaultValue={s("student")} className="sm:max-w-[180px]">
          <option value="">All students</option>
          {students.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select name="subject" defaultValue={s("subject")} className="sm:max-w-[160px]">
          <option value="">All subjects</option>
          {subjects.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={s("type")} className="sm:max-w-[150px]">
          <option value="">All types</option>
          <option value="ONE_TO_ONE">One-to-one</option>
          <option value="GROUP">Group</option>
        </Select>
        <Select name="status" defaultValue={status} className="sm:max-w-[190px]">
          <option value="">All statuses</option>
          {FILTER_STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_META[st].label}
            </option>
          ))}
        </Select>
        <button className="rounded-full bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </form>
      <Card>
        <CardHeader title={`${sessions.length} lesson${sessions.length === 1 ? "" : "s"}`} />
        <SessionTable sessions={sessions} timeZone={tz} showDate={days > 1} empty="No lessons match these filters." />
      </Card>
    </>
  );
}
