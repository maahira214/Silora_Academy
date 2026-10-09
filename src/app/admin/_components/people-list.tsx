import Link from "next/link";
import type { Prisma, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { fmtDate } from "@/lib/time";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, cx } from "@/components/ui";
import { Input, Select } from "@/components/forms";

export const STATUS_TONE: Record<UserStatus, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DEACTIVATED: "neutral",
};

export type PeopleRole = "TEACHER" | "STUDENT";

/** Teachers and students on one page, with a role filter. */
export async function PeopleList({
  user,
  role,
  q,
  status,
}: {
  user: CurrentUser;
  role?: PeopleRole;
  q?: string;
  status?: UserStatus;
}) {
  const where: Prisma.UserWhereInput = {
    orgId: user.orgId,
    role: role ?? { in: ["TEACHER", "STUDENT"] },
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
  const tz = user.timezone ?? user.org.timezone;
  const detailHref = (p: { id: string; role: string }) => `/admin/${p.role === "TEACHER" ? "teachers" : "students"}/${p.id}`;
  const filterHref = (r?: PeopleRole) => {
    const sp = new URLSearchParams();
    if (r) sp.set("role", r === "TEACHER" ? "teachers" : "students");
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    const qs = sp.toString();
    return `/admin/people${qs ? `?${qs}` : ""}`;
  };
  const tabs: [string, PeopleRole | undefined][] = [
    ["Everyone", undefined],
    ["Teachers", "TEACHER"],
    ["Students", "STUDENT"],
  ];
  const count =
    people.length === 1 ? "1 person" : `${people.length} ${role === "TEACHER" ? "teachers" : role === "STUDENT" ? "students" : "people"}`;

  return (
    <>
      <PageHeader
        title="People"
        subtitle={count}
        actions={
          <>
            <ButtonLink href="/admin/people/import" variant="secondary">
              Import from spreadsheet
            </ButtonLink>
            <ButtonLink href="/admin/teachers/new" variant="secondary">
              + Add teacher
            </ButtonLink>
            <ButtonLink href="/admin/students/new">+ Add student</ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex w-fit gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
        {tabs.map(([label, r]) => (
          <Link
            key={label}
            href={filterHref(r)}
            aria-current={role === r ? "page" : undefined}
            className={cx("rounded-full px-4 py-1.5 text-sm font-bold", role === r ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            {label}
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        {role && <input type="hidden" name="role" value={role === "TEACHER" ? "teachers" : "students"} />}
        <Input name="q" defaultValue={q} placeholder="Search by name or email" className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[180px]">
          <option value="">Active & suspended</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </Select>
        <button className="rounded-full bg-navy-800 px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <Card>
        {people.length === 0 ? (
          <EmptyState title="Nobody found" body={q ? "Try a different name or email." : undefined} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Details</Th>
                <Th>Active classes</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={detailHref(p)} className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span>
                        <span className="block font-semibold text-navy-900 hover:underline">{p.name}</span>
                        <span className="block text-xs text-slate-500">{p.email}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>{p.role === "TEACHER" ? "Teacher" : "Student"}</Td>
                  <Td>
                    {p.role === "TEACHER"
                      ? p.teacherProfile?.headline ?? "—"
                      : [p.studentProfile?.grade, p.studentProfile?.board].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td className="tabular-nums">{p.role === "TEACHER" ? p._count.teaching : p._count.enrollments}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                      {p.role === "STUDENT" && !p.studentProfile?.guardianConsentAt && <Badge tone="danger">No parent consent</Badge>}
                    </span>
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
