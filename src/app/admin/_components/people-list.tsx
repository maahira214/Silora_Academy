import Link from "next/link";
import type { Prisma, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { fmtDate } from "@/lib/time";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Input, Select } from "@/components/forms";

export const STATUS_TONE: Record<UserStatus, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DEACTIVATED: "neutral",
};

export async function PeopleList({
  user,
  role,
  q,
  status,
}: {
  user: CurrentUser;
  role: "TEACHER" | "STUDENT";
  q?: string;
  status?: UserStatus;
}) {
  const where: Prisma.UserWhereInput = {
    orgId: user.orgId,
    role,
    status: status ?? { not: "DEACTIVATED" },
    OR: q ? [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
  };
  const people = await db.user.findMany({
    where,
    include: {
      teacherProfile: true,
      studentProfile: true,
      _count: {
        select: {
          teaching: { where: { status: "ACTIVE" } },
          enrollments: { where: { status: "ACTIVE", course: { status: "ACTIVE" } } },
        },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  });
  const base = role === "TEACHER" ? "/admin/teachers" : "/admin/students";
  const noun = role === "TEACHER" ? "teacher" : "student";
  const tz = user.timezone ?? user.org.timezone;

  return (
    <>
      <PageHeader
        title={role === "TEACHER" ? "Teachers" : "Students"}
        subtitle={`${people.length} ${noun}${people.length === 1 ? "" : "s"}`}
        actions={<ButtonLink href={`${base}/new`}>+ Add {noun}</ButtonLink>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={`Search ${noun}s by name or email`} className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[180px]">
          <option value="">Active & suspended</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </Select>
        <button className="rounded-full bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <Card>
        {people.length === 0 ? (
          <EmptyState title={`No ${noun}s found`} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>{role === "TEACHER" ? "Title" : "Grade / board"}</Th>
                <Th>Active classes</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span>
                        <span className="block font-semibold text-navy-900 hover:underline">{p.name}</span>
                        <span className="block text-xs text-slate-500">{p.email}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    {role === "TEACHER"
                      ? p.teacherProfile?.headline ?? "—"
                      : [p.studentProfile?.grade, p.studentProfile?.board].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td className="tabular-nums">{role === "TEACHER" ? p._count.teaching : p._count.enrollments}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-xs text-slate-500">{p.lastLoginAt ? fmtDate(p.lastLoginAt, tz) : "Never"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
