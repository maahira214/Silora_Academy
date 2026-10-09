import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/authz";
import { PageHeader } from "@/components/ui";
import { ImportPeople } from "./import-people";

export const metadata: Metadata = { title: "Import people" };

export default async function Page() {
  await requirePagePermission("people.edit");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/people", label: "People" }}
        title="Import teachers and students"
        subtitle="Add many people at once from a spreadsheet. Nothing is created until you confirm."
      />
      <div className="max-w-5xl">
        <ImportPeople />
      </div>
    </>
  );
}
