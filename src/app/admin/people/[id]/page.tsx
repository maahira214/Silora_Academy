import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";

// Stable link to anyone's profile when only their id is known (alerts, notifications).
export default async function Page({ params }: PageProps<"/admin/people/[id]">) {
  const user = await requirePagePermission("people.view");
  const { id } = await params;
  const person = await db.user.findFirst({ where: { id, orgId: user.orgId }, select: { role: true } });
  if (!person) notFound();
  redirect(person.role === "TEACHER" ? `/admin/teachers/${id}` : person.role === "STUDENT" ? `/admin/students/${id}` : "/admin/staff");
}
