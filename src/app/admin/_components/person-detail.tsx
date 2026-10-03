import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import { fmtDateTime } from "@/lib/time";
import { setUserStatusAction, updatePersonAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th } from "@/components/ui";
import { PersonForm } from "./person-form";
import { STATUS_TONE } from "./people-list";

export async function PersonDetail({ user, id, role }: { user: CurrentUser; id: string; role: "TEACHER" | "STUDENT" }) {
  const person = await db.user.findFirst({
    where: { id, orgId: user.orgId, role },
    include: { teacherProfile: true, studentProfile: true },
  });
  if (!person) notFound();

  const courses = await db.course.findMany({
    where: role === "TEACHER" ? { teacherId: id } : { students: { some: { studentId: id } } },
    include: { subject: true, teacher: true, students: { where: { status: "ACTIVE" }, include: { student: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const recentAudit = await db.auditLog.findMany({
    where: { orgId: user.orgId, OR: [{ actorId: id }, { targetId: id }] },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const tz = user.timezone ?? user.org.timezone;
  const base = role === "TEACHER" ? "/admin/teachers" : "/admin/students";
  const canSuspend = can(user, "people.suspend");

  return (
    <>
      <PageHeader
        back={{ href: base, label: role === "TEACHER" ? "Teachers" : "Students" }}
        title={person.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[person.status]}>{person.status.toLowerCase()}</Badge>
            <span>{person.email}</span>
            <span>· Last sign-in: {person.lastLoginAt ? fmtDateTime(person.lastLoginAt, tz) : "never"}</span>
          </span>
        }
      />

      {person.status !== "ACTIVE" && (
        <div className="mb-6">
          <Notice tone="warning">
            This account is {person.status.toLowerCase()}. They cannot sign in, join classes or send messages.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={role === "TEACHER" ? "Classes taught" : "Classes"} subtitle="Each row is one Silora relationship with its own Meet link" />
            {courses.length === 0 ? (
              <EmptyState title="No classes yet" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th>{role === "TEACHER" ? "Student(s)" : "Teacher"}</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link className="font-semibold text-navy-800 hover:underline" href={`/admin/classes/${c.id}`}>
                          {c.title}
                        </Link>
                      </Td>
                      <Td>{role === "TEACHER" ? c.students.map((s) => s.student.name).join(", ") : c.teacher.name}</Td>
                      <Td>{c.type === "GROUP" ? "Group" : "One-to-one"}</Td>
                      <Td>
                        <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Profile" />
            <div className="p-5">
              <PersonForm kind={role} person={person} action={updatePersonAction.bind(null, person.id)} submitLabel="Save changes" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account access" />
            <div className="space-y-3 p-5 text-sm text-slate-600">
              {!canSuspend && <p>Only a Super Admin can suspend or deactivate accounts.</p>}
              {canSuspend && person.status === "ACTIVE" && (
                <>
                  <p>Suspending signs them out everywhere and blocks classes and messages until reactivated.</p>
                  <ActionForm action={setUserStatusAction.bind(null, person.id, "SUSPENDED")}>
                    <SubmitButton variant="secondary" confirm={`Suspend ${person.name}?`}>
                      Suspend account
                    </SubmitButton>
                  </ActionForm>
                  <p className="pt-2">
                    {role === "TEACHER"
                      ? "Deactivating also raises alerts for any classes that still need a teacher."
                      : "Deactivating ends their one-to-one classes and removes them from groups. History is kept."}
                  </p>
                  <ActionForm action={setUserStatusAction.bind(null, person.id, "DEACTIVATED")}>
                    <SubmitButton variant="danger" confirm={`Deactivate ${person.name}? They will leave Silora.`}>
                      Deactivate (left Silora)
                    </SubmitButton>
                  </ActionForm>
                </>
              )}
              {canSuspend && person.status !== "ACTIVE" && (
                <ActionForm action={setUserStatusAction.bind(null, person.id, "ACTIVE")}>
                  <SubmitButton>Reactivate account</SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {recentAudit.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="font-medium text-slate-800">
                      {a.action.replaceAll("_", " ").toLowerCase()}
                      {a.result !== "SUCCESS" && <span className="ml-1 text-red-700">({a.result.toLowerCase()})</span>}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{fmtDateTime(a.createdAt, tz)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
