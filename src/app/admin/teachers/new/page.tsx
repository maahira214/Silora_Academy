import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/authz";
import { createPersonAction } from "@/app/admin/actions";
import { Card, PageHeader } from "@/components/ui";
import { PersonForm } from "../../_components/person-form";

export const metadata: Metadata = { title: "Add teacher" };

export default async function Page() {
  await requirePagePermission("people.edit");
  return (
    <>
      <PageHeader back={{ href: "/admin/people?role=teachers", label: "People" }} title="Add teacher" subtitle="They will sign in with Google using this email. No password is needed." />
      <Card className="max-w-3xl p-6">
        <PersonForm kind="TEACHER" action={createPersonAction.bind(null, "TEACHER")} submitLabel="Create teacher" />
      </Card>
    </>
  );
}
