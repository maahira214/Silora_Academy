import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/authz";
import { createPersonAction } from "@/app/admin/actions";
import { Card, PageHeader } from "@/components/ui";
import { PersonForm } from "../../_components/person-form";

export const metadata: Metadata = { title: "Add student" };

export default async function Page() {
  await requirePagePermission("people.edit");
  return (
    <>
      <PageHeader back={{ href: "/admin/people?role=students", label: "People" }} title="Add student" subtitle="They will sign in with Google using this email. No password is needed." />
      <Card className="max-w-3xl p-6">
        <PersonForm kind="STUDENT" action={createPersonAction.bind(null, "STUDENT")} submitLabel="Create student" />
      </Card>
    </>
  );
}
