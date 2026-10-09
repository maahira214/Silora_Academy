import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, requirePagePermission } from "@/lib/authz";
import { fmt, fmtDate, fmtDateTime, fmtTime, localDateKey, minutesBetween } from "@/lib/time";
import { loadSessions } from "@/server/sessions";
import { cancelSessionAction, markSessionAction, rescheduleSessionAction } from "@/app/admin/actions";
import { AlertList } from "@/components/alert-list";
import { RecordingCard } from "../../_components/recording-card";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { StatusBadge } from "@/components/session-table";
import { Card, CardHeader, DefinitionList, Notice, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Lesson" };

export default async function SessionPage({ params }: PageProps<"/admin/sessions/[id]">) {
  const user = await requirePagePermission("people.view");
  const { id } = await params;
  const [s] = await loadSessions({ id }, user.org);
  if (!s) notFound();
  const tz = user.timezone ?? user.org.timezone;

  const [alerts, messages, files] = await Promise.all([
    db.alert.findMany({ where: { sessionId: id }, orderBy: { createdAt: "desc" } }),
    db.message.count({ where: { thread: { courseId: s.courseId }, createdAt: { gte: s.startsAt, lte: s.endsAt } } }),
    db.message.count({ where: { thread: { courseId: s.courseId }, attachmentId: { not: null }, createdAt: { gte: s.startsAt, lte: s.endsAt } } }),
  ]);

  const people = [
    { id: s.course.teacherId, name: s.course.teacher.name, role: "Teacher" },
    ...s.course.students.map((cs) => ({ id: cs.studentId, name: cs.student.name, role: "Student" })),
  ];
  const att = (uid: string) => s.attendance.find((a) => a.userId === uid);
  const manage = can(user, "sessions.manage");
  const editable = s.status === "SCHEDULED" && s.endsAt > new Date();

  return (
    <>
      <PageHeader
        back={{ href: `/admin/classes/${s.courseId}`, label: s.course.title }}
        title={`${s.course.subject.name} · ${fmtDate(s.startsAt, tz)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.live} />
            <span>
              {fmtTime(s.startsAt, tz)} – {fmtTime(s.endsAt, tz)} ({minutesBetween(s.startsAt, s.endsAt)} min)
            </span>
            <span className="font-mono text-xs text-slate-400">#{s.id.slice(-8)}</span>
          </span>
        }
        actions={
          s.course.meetUrl && (
            <a href={`/join/${s.id}`} target="_blank" className={buttonClass("navy")}>
              Open Meet (staff, audited)
            </a>
          )
        }
      />
      {s.status === "CANCELLED" && (
        <div className="mb-6">
          <Notice tone="neutral">Cancelled{s.cancelReason ? `: ${s.cancelReason}` : "."}</Notice>
        </div>
      )}
      {s.issueNote && (
        <div className="mb-6">
          <Notice tone="warning">Issue reported: {s.issueNote}</Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Attendance"
              subtitle={
                s.course.meetMode === "MANUAL"
                  ? "Joins recorded when people use Join Class in Silora (Google Meet data needs the Workspace integration)."
                  : "From Google Meet participant data."
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th>Lateness</Th>
                  <Th>Join clicks</Th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const a = att(p.id);
                  const joinedAt = a?.meetJoinedAt ?? a?.firstJoinAt;
                  const late = joinedAt ? minutesBetween(s.startsAt, joinedAt) : null;
                  return (
                    <tr key={p.id}>
                      <Td className="font-semibold text-navy-900">{p.name}</Td>
                      <Td>{p.role}</Td>
                      <Td>{joinedAt ? fmtTime(joinedAt, tz) : <span className="text-slate-400">Not joined</span>}</Td>
                      <Td>
                        {late === null ? "—" : late <= 0 ? <span className="text-emerald-700">On time</span> : <span className="text-orange-700">{late} min late</span>}
                      </Td>
                      <Td className="tabular-nums">{a?.joinCount ?? 0}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Alerts for this lesson" />
            <AlertList alerts={alerts} timeZone={tz} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Lesson record" />
            <div className="p-5">
              <DefinitionList
                items={[
                  ["Class", <Link key="c" className="font-semibold text-navy-800 hover:underline" href={`/admin/classes/${s.courseId}`}>{s.course.title}</Link>],
                  ["Teacher", s.course.teacher.name],
                  ["Student(s)", s.course.students.map((cs) => cs.student.name).join(", ")],
                  ["Meet", s.course.meetCode ?? "Not set"],
                  ["Chat during lesson", `${messages} messages · ${files} files`],
                  ["Originally", s.originalStartsAt ? fmtDateTime(s.originalStartsAt, tz) : "—"],
                ]}
              />
            </div>
          </Card>

          {can(user, "recordings.view") && s.status !== "CANCELLED" && (
            <RecordingCard sessionId={s.id} timeZone={tz} lessonStarted={s.startsAt <= new Date()} />
          )}

          {manage && editable && (
            <Card>
              <CardHeader title="Reschedule" />
              <ActionForm action={rescheduleSessionAction.bind(null, s.id, s.course.timezone)} className="space-y-3 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <Input type="date" name="date" required defaultValue={localDateKey(s.startsAt, s.course.timezone)} />
                  </Field>
                  <Field label={`Time (${s.course.timezone})`}>
                    <Input type="time" name="time" required defaultValue={fmt(s.startsAt, s.course.timezone, "HH:mm")} />
                  </Field>
                </div>
                <Field label="Minutes">
                  <Input type="number" name="durationMin" min={15} max={300} step={5} defaultValue={minutesBetween(s.startsAt, s.endsAt)} />
                </Field>
                <SubmitButton variant="secondary">Reschedule & notify</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {manage && editable && (
            <Card>
              <CardHeader title="Cancel lesson" />
              <ActionForm action={cancelSessionAction.bind(null, s.id)} className="space-y-3 p-5">
                <Input name="reason" placeholder="Reason (shared with Silora staff)" />
                <SubmitButton variant="danger" confirm="Cancel this lesson and notify everyone?">
                  Cancel & notify
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
          {manage && s.status !== "CANCELLED" && s.startsAt < new Date() && (
            <Card>
              <CardHeader title="Set outcome" subtitle="Override the automatic outcome if needed" />
              <ActionForm action={markSessionAction.bind(null, s.id)} className="space-y-3 p-5">
                <Select name="status" defaultValue={s.status === "SCHEDULED" ? "COMPLETED" : s.status}>
                  <option value="COMPLETED">Completed</option>
                  <option value="TEACHER_ABSENT">Teacher absent</option>
                  <option value="STUDENT_ABSENT">Student absent</option>
                  <option value="NO_SHOW">No show</option>
                  <option value="TECHNICAL_ISSUE">Technical issue</option>
                </Select>
                <SubmitButton variant="secondary">Save outcome</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
