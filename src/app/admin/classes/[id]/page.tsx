import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, requirePagePermission } from "@/lib/authz";
import { describeRule } from "@/lib/schedule";
import { fmtDateTime, localDateKey } from "@/lib/time";
import { loadSessions } from "@/server/sessions";
import {
  addLessonAction,
  addScheduleAction,
  addStudentAction,
  endCourseAction,
  removeStudentAction,
  replaceTeacherAction,
  setChatEnabledAction,
  stopScheduleAction,
  updateMeetLinkAction,
} from "@/app/admin/actions";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { SessionTable } from "@/components/session-table";
import { Avatar, Badge, Card, CardHeader, DefinitionList, Notice, PageHeader, buttonClass } from "@/components/ui";
import { ScheduleFields } from "../../_components/schedule-fields";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: PageProps<"/admin/classes/[id]">) {
  const user = await requirePagePermission("people.view");
  const { id } = await params;
  const course = await db.course.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      subject: true,
      teacher: { include: { teacherProfile: true } },
      students: { include: { student: { include: { studentProfile: true } } }, orderBy: { addedAt: "asc" } },
      schedules: { orderBy: { createdAt: "asc" } },
      threads: true,
    },
  });
  if (!course) notFound();

  const tz = user.timezone ?? user.org.timezone;
  const now = new Date();
  const [upcoming, recent, teachers, otherStudents, counts] = await Promise.all([
    loadSessions({ courseId: id, endsAt: { gte: now } }, user.org, { take: 12 }),
    loadSessions({ courseId: id, endsAt: { lt: now } }, user.org, { take: 10, order: "desc" }),
    db.user.findMany({ where: { orgId: user.orgId, role: "TEACHER", status: "ACTIVE", NOT: { id: course.teacherId } }, orderBy: { name: "asc" } }),
    course.type === "GROUP"
      ? db.user.findMany({
          where: { orgId: user.orgId, role: "STUDENT", status: "ACTIVE", NOT: { id: { in: course.students.filter((s) => s.status === "ACTIVE").map((s) => s.studentId) } } },
          orderBy: { name: "asc" },
        })
      : [],
    db.classSession.groupBy({ by: ["status"], where: { courseId: id, endsAt: { lt: now } }, _count: true }),
  ]);

  const active = course.status === "ACTIVE";
  const manage = can(user, "classes.manage") && active;
  const activeStudents = course.students.filter((s) => s.status === "ACTIVE");
  const courseThread = course.threads.find((t) => t.kind === "COURSE");
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/classes", label: "Classes" }}
        title={course.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={active ? "success" : "neutral"}>{course.status.toLowerCase()}</Badge>
            <span>
              {course.subject.name} · {course.type === "GROUP" ? "Group class" : "One-to-one"}
              {course.grade ? ` · ${course.grade}` : ""}
              {course.board ? ` · ${course.board}` : ""}
            </span>
          </span>
        }
        actions={
          course.meetUrl && (
            <a href={course.meetUrl} target="_blank" rel="noreferrer" className={buttonClass("navy")}>
              Open Meet (staff)
            </a>
          )
        }
      />

      {!active && (
        <div className="mb-6">
          <Notice tone="neutral">
            This class ended{course.endedAt ? ` on ${fmtDateTime(course.endedAt, tz)}` : ""}
            {course.endedReason ? ` — ${course.endedReason}` : ""}. History is kept; chat is read-only.
          </Notice>
        </div>
      )}
      {active && !course.meetUrl && (
        <div className="mb-6">
          <Notice tone="danger">This class has no Google Meet link yet, so participants cannot join. Add one below.</Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Upcoming lessons" />
            <SessionTable sessions={upcoming} timeZone={tz} showDate compact empty="No upcoming lessons." />
            {can(user, "sessions.manage") && active && (
              <details className="border-t border-slate-100 px-5 py-4">
                <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a one-off lesson</summary>
                <ActionForm action={addLessonAction.bind(null, course.id, course.timezone)} className="mt-4 grid gap-4 sm:grid-cols-4" resetOnSuccess>
                  <Field label="Date">
                    <Input type="date" name="date" required defaultValue={localDateKey(now, course.timezone)} />
                  </Field>
                  <Field label={`Time (${course.timezone})`}>
                    <Input type="time" name="time" required />
                  </Field>
                  <Field label="Minutes">
                    <Input type="number" name="durationMin" defaultValue={60} min={15} max={300} step={5} />
                  </Field>
                  <div className="flex items-end">
                    <SubmitButton>Add lesson</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent lessons"
              subtitle={`Completed ${count("COMPLETED")} · Teacher absent ${count("TEACHER_ABSENT")} · Student absent ${count("STUDENT_ABSENT")} · No-show ${count("NO_SHOW")} · Cancelled ${count("CANCELLED")}`}
            />
            <SessionTable sessions={recent} timeZone={tz} showDate compact empty="No past lessons yet." />
          </Card>

          <Card>
            <CardHeader title="Recurring schedules" subtitle="Lessons are generated 8 weeks ahead and extended automatically." />
            <ul className="divide-y divide-slate-100">
              {course.schedules.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No recurring schedule.</li>}
              {course.schedules.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{describeRule(s)}</p>
                    <p className="text-xs text-slate-500">
                      From {s.validFrom.toISOString().slice(0, 10)}
                      {s.validUntil ? ` until ${s.validUntil.toISOString().slice(0, 10)}` : ""}
                    </p>
                  </div>
                  {s.active ? (
                    manage && (
                      <ActionForm action={stopScheduleAction.bind(null, course.id, s.id)}>
                        <SubmitButton variant="secondary" size="sm" confirm="Stop this schedule? Future lessons from it will be removed.">
                          Stop schedule
                        </SubmitButton>
                      </ActionForm>
                    )
                  ) : (
                    <Badge>Stopped</Badge>
                  )}
                </li>
              ))}
            </ul>
            {manage && (
              <details className="border-t border-slate-100 px-5 py-4">
                <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a recurring schedule</summary>
                <ActionForm action={addScheduleAction.bind(null, course.id)} className="mt-4 space-y-4" resetOnSuccess>
                  <ScheduleFields defaultTz={course.timezone} today={localDateKey(now, course.timezone)} />
                  <SubmitButton>Add schedule</SubmitButton>
                </ActionForm>
              </details>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Google Meet" subtitle="One permanent link for every lesson of this class" />
            <div className="space-y-4 p-5">
              {course.meetUrl ? (
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="font-mono text-sm font-semibold text-navy-900">{course.meetCode}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {course.meetMode === "MANUAL" ? "Created manually from Silora's Google account" : "Managed through the Google Meet API"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No link yet.</p>
              )}
              <p className="text-xs text-slate-500">
                Teachers and students never get this link directly. They join through Silora, which checks their assignment and records attendance.
              </p>
              {manage && (
                <ActionForm action={updateMeetLinkAction.bind(null, course.id)} className="space-y-3">
                  <Field label={course.meetUrl ? "Replace link" : "Add link"}>
                    <Input name="meetLink" required placeholder="https://meet.google.com/abc-defg-hij" />
                  </Field>
                  <SubmitButton variant="secondary" size="sm" confirm={course.meetUrl ? "Replace the Meet link for all future lessons?" : undefined}>
                    Save link
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="People" />
            <div className="space-y-4 p-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher</p>
                <Link href={`/admin/teachers/${course.teacher.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                  <Avatar name={course.teacher.name} />
                  <span>
                    <span className="block font-semibold text-navy-900">{course.teacher.name}</span>
                    <span className="block text-xs text-slate-500">
                      {course.teacher.teacherProfile?.headline ?? "Teacher"}
                      {course.teacher.status !== "ACTIVE" && <span className="ml-1 font-semibold text-red-700">({course.teacher.status.toLowerCase()})</span>}
                    </span>
                  </span>
                </Link>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Students ({activeStudents.length})</p>
                <ul className="space-y-1">
                  {activeStudents.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <Link href={`/admin/students/${s.studentId}`} className="flex flex-1 items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                        <Avatar name={s.student.name} size="sm" />
                        <span className="text-sm font-semibold text-navy-900">{s.student.name}</span>
                      </Link>
                      {manage && course.type === "GROUP" && (
                        <ActionForm action={removeStudentAction.bind(null, course.id, s.studentId)}>
                          <SubmitButton variant="ghost" size="sm" confirm={`Remove ${s.student.name} from this group?`}>
                            Remove
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </li>
                  ))}
                </ul>
                {manage && course.type === "GROUP" && otherStudents.length > 0 && (
                  <ActionForm action={addStudentAction.bind(null, course.id)} className="mt-3 flex gap-2" resetOnSuccess>
                    <Select name="studentId" required defaultValue="" className="flex-1">
                      <option value="" disabled>
                        Add a student…
                      </option>
                      {otherStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton size="sm" variant="secondary">
                      Add
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Messaging" />
            <div className="space-y-3 p-5 text-sm">
              <DefinitionList items={[["Status", course.chatEnabled ? "Enabled" : "Paused by Silora"]]} />
              {can(user, "chat.control") && active && (
                <ActionForm action={setChatEnabledAction.bind(null, course.id, !course.chatEnabled)}>
                  <SubmitButton variant="secondary" size="sm">
                    {course.chatEnabled ? "Pause messaging" : "Enable messaging"}
                  </SubmitButton>
                </ActionForm>
              )}
              {can(user, "chat.review") && courseThread && (
                <Link href={`/admin/moderation/thread/${courseThread.id}`} className="block text-sm font-semibold text-gold-700 hover:underline">
                  View conversation (audited) →
                </Link>
              )}
            </div>
          </Card>

          {manage && (
            <Card className="ring-red-100">
              <CardHeader title="Change or end this class" />
              <div className="space-y-6 p-5">
                <ActionForm action={replaceTeacherAction.bind(null, course.id)} className="space-y-3">
                  <p className="text-sm text-slate-600">
                    <strong>Replace teacher</strong> starts a new class with the new teacher, a new Meet link and a new chat. This class ends
                    and the old teacher loses access.
                  </p>
                  <Select name="teacherId" required defaultValue="">
                    <option value="" disabled>
                      New teacher…
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <Input name="meetLink" placeholder="New Meet link (can be added later)" />
                  <SubmitButton variant="secondary" confirm="Replace the teacher? This class will end and a new one will be created.">
                    Replace teacher
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={endCourseAction.bind(null, course.id)} className="space-y-3 border-t border-slate-100 pt-5">
                  <p className="text-sm text-slate-600">
                    <strong>End class</strong> cancels future lessons and makes the chat read-only.
                  </p>
                  <Input name="reason" placeholder="Reason (optional)" />
                  <SubmitButton variant="danger" confirm="End this class? Future lessons will be cancelled.">
                    End class
                  </SubmitButton>
                </ActionForm>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
