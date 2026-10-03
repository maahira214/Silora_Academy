import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalThread } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Conversation" };

export default async function Page({ params }: PageProps<"/teacher/messages/[id]">) {
  const user = await requirePageUser("TEACHER");
  const { id } = await params;
  return <PortalThread user={user} id={id} />;
}
