import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalClasses } from "@/components/portal/pages";

export const metadata: Metadata = { title: "My classes" };

export default async function Page() {
  return <PortalClasses user={await requirePageUser("TEACHER")} />;
}
