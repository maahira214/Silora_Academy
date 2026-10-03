import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/authz";
import { PersonDetail } from "../../_components/person-detail";

export const metadata: Metadata = { title: "Students" };

export default async function Page({ params }: PageProps<"/admin/students/[id]">) {
  const user = await requirePagePermission("people.view");
  const { id } = await params;
  return <PersonDetail user={user} id={id} role="STUDENT" />;
}
