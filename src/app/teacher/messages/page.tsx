import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalMessages } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Messages" };

export default async function Page() {
  return <PortalMessages user={await requirePageUser("TEACHER")} />;
}
