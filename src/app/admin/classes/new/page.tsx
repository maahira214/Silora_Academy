import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { localDateKey } from "@/lib/time";
import { createCourseAction } from "@/app/admin/actions";
import { PageHeader } from "@/components/ui";
import { BOARDS } from "../../_components/person-form";
import { ScheduleFields } from "../../_components/schedule-fields";
import { CourseForm } from "./course-form";

export const metadata: Metadata = { title: "New class" };

export default async function NewClassPage() {
  const user = await requirePagePermission("classes.manage");
  const [teachers, students, subjects] = await Promise.all([
    db.user.findMany({ where: { orgId: user.orgId, role: "TEACHER", status: "ACTIVE" }, include: { teacherProfile: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { orgId: user.orgId, role: "STUDENT", status: "ACTIVE" }, include: { studentProfile: true }, orderBy: { name: "asc" } }),
    db.subject.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" } }),
  ]);
  const tz = user.org.timezone;

  return (
    <>
      <PageHeader back={{ href: "/admin/classes", label: "Classes" }} title="New class" />
      <div className="max-w-3xl">
        <CourseForm
          action={createCourseAction}
          defaultTz={tz}
          teachers={teachers.map((t) => ({ id: t.id, name: t.name, detail: t.teacherProfile?.headline }))}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            detail: [s.studentProfile?.grade, s.studentProfile?.board].filter(Boolean).join(" · ") || null,
          }))}
          subjects={subjects.map((s) => s.name)}
          boards={BOARDS}
          scheduleFields={<ScheduleFields defaultTz={tz} today={localDateKey(new Date(), tz)} withTimezone={false} />}
        />
      </div>
    </>
  );
}
