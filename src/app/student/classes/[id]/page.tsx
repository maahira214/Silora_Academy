import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalClassDetail } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Class" };

export default async function Page({ params }: PageProps<"/student/classes/[id]">) {
  const user = await requirePageUser("STUDENT");
  const { id } = await params;
  return <PortalClassDetail user={user} id={id} />;
}
