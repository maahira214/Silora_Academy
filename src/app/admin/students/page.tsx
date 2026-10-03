import type { Metadata } from "next";
import type { UserStatus } from "@prisma/client";
import { requirePagePermission } from "@/lib/authz";
import { PeopleList } from "../_components/people-list";

export const metadata: Metadata = { title: "Students" };

export default async function Page({ searchParams }: PageProps<"/admin/students">) {
  const user = await requirePagePermission("people.view");
  const sp = await searchParams;
  const status = ["ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(String(sp.status)) ? (sp.status as UserStatus) : undefined;
  return <PeopleList user={user} role="STUDENT" q={typeof sp.q === "string" ? sp.q : undefined} status={status} />;
}
