import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { describeRule } from "@/lib/schedule";
import { Input, Select } from "@/components/forms";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage({ searchParams }: PageProps<"/admin/classes">) {
  const user = await requirePagePermission("people.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = sp.status === "ENDED" ? "ENDED" : sp.status === "ALL" ? undefined : "ACTIVE";
  const type = sp.type === "GROUP" || sp.type === "ONE_TO_ONE" ? sp.type : undefined;
  const subjectId = typeof sp.subject === "string" && sp.subject ? sp.subject : undefined;
  const missingMeet = sp.meet === "missing";

  const where: Prisma.CourseWhereInput = {
    orgId: user.orgId,
    status,
    type,
    subjectId,
    meetUrl: missingMeet ? null : undefined,
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { teacher: { name: { contains: q, mode: "insensitive" } } },
          { students: { some: { student: { name: { contains: q, mode: "insensitive" } } } } },
        ]
      : undefined,
  };
  const [courses, subjects] = await Promise.all([
    db.course.findMany({
      where,
      include: {
        subject: true,
        teacher: { select: { name: true } },
        students: { where: { status: "ACTIVE" }, include: { student: { select: { name: true } } } },
        schedules: { where: { active: true } },
      },
      orderBy: [{ status: "asc" }, { title: "asc" }],
      take: 500,
    }),
    db.subject.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Each class is one Silora relationship: Student + Teacher + Subject (or one group), with one permanent Meet link."
        actions={<ButtonLink href="/admin/classes/new">+ New class</ButtonLink>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Search class, teacher or student" className="max-w-xs" />
        <Select name="subject" defaultValue={subjectId ?? ""} className="max-w-[180px]">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ""} className="max-w-[160px]">
          <option value="">All types</option>
          <option value="ONE_TO_ONE">One-to-one</option>
          <option value="GROUP">Group</option>
        </Select>
        <Select name="status" defaultValue={typeof sp.status === "string" ? sp.status : "ACTIVE"} className="max-w-[140px]">
          <option value="ACTIVE">Active</option>
          <option value="ENDED">Ended</option>
          <option value="ALL">All</option>
        </Select>
        <Select name="meet" defaultValue={missingMeet ? "missing" : ""} className="max-w-[180px]">
          <option value="">Any Meet link</option>
          <option value="missing">Missing Meet link</option>
        </Select>
        <button className="rounded-full bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <Card>
        {courses.length === 0 ? (
          <EmptyState title="No classes found" action={<ButtonLink href="/admin/classes/new">Create a class</ButtonLink>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Class</Th>
                <Th>Teacher</Th>
                <Th>Student(s)</Th>
                <Th>Schedule</Th>
                <Th>Meet</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/admin/classes/${c.id}`} className="font-semibold text-navy-800 hover:underline">
                      {c.title}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {c.subject.name} · {c.type === "GROUP" ? "Group" : "One-to-one"}
                    </span>
                  </Td>
                  <Td>{c.teacher.name}</Td>
                  <Td className="max-w-[200px]">
                    <span className="line-clamp-2">{c.students.map((s) => s.student.name).join(", ") || "—"}</span>
                  </Td>
                  <Td className="max-w-[260px] text-xs text-slate-600">
                    {c.schedules.length ? c.schedules.map((s) => <div key={s.id}>{describeRule(s)}</div>) : "No recurring schedule"}
                  </Td>
                  <Td>{c.meetUrl ? <Badge tone="success">Set</Badge> : <Badge tone="danger">Missing</Badge>}</Td>
                  <Td>
                    <Badge tone={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
