import type { Metadata } from "next";
import { requirePageUser } from "@/lib/authz";
import { PortalHome } from "@/components/portal/pages";

export const metadata: Metadata = { title: "Home" };

export default async function Page() {
  return <PortalHome user={await requirePageUser("STUDENT")} />;
}
