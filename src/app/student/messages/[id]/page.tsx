import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalThread } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Conversation" };

export default async function Page({ params, searchParams }: PageProps<"/student/messages/[id]">) {
  const user = await requirePageUser("STUDENT");
  const { id } = await params;
  const { tab } = await searchParams;
  return <PortalThread user={user} id={id} tab={typeof tab === "string" ? tab : undefined} />;
}
