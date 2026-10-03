import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalFiles } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Files" };

export default async function Page() {
  return <PortalFiles user={await requirePageUser("STUDENT")} />;
}
