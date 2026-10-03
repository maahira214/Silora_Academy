import { redirect } from "next/navigation";
import { requirePageUser, isStaffRole } from "@/lib/authz";

// Role-neutral link used in notifications → the right page for the viewer.
export default async function ClassRedirect({ params }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const user = await requirePageUser();
  if (isStaffRole(user.role)) redirect(`/admin/classes/${id}`);
  redirect(`/${user.role === "TEACHER" ? "teacher" : "student"}/classes/${id}`);
}
