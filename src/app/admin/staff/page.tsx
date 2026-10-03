import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { fmtDate } from "@/lib/time";
import { changeStaffRoleAction, createPersonAction, setUserStatusAction } from "@/app/admin/actions";
import { ActionForm, Select, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { PersonForm } from "../_components/person-form";
import { STATUS_TONE } from "../_components/people-list";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const user = await requirePagePermission("staff.manage");
  const tz = user.timezone ?? user.org.timezone;
  const staff = await db.user.findMany({
    where: { orgId: user.orgId, role: { in: ["SUPER_ADMIN", "OPERATIONS"] } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Super Admins have full access. Operations staff run day-to-day classes but cannot change settings, read chats, suspend accounts or see the audit log."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size="sm" />
                      <div>
                        <div className="font-semibold text-navy-900">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {s.id === user.id ? (
                      <Badge tone="brand">{s.role === "SUPER_ADMIN" ? "Super Admin" : "Operations"} (you)</Badge>
                    ) : (
                      <ActionForm action={changeStaffRoleAction.bind(null, s.id)} className="flex items-center gap-2">
                        <Select name="role" defaultValue={s.role} className="w-40 py-1.5">
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="OPERATIONS">Operations</option>
                        </Select>
                        <SubmitButton size="sm" variant="ghost">
                          Save
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-xs text-slate-500">{s.lastLoginAt ? fmtDate(s.lastLoginAt, tz) : "Never"}</Td>
                  <Td className="text-right">
                    {s.id !== user.id &&
                      (s.status === "ACTIVE" ? (
                        <ActionForm action={setUserStatusAction.bind(null, s.id, "DEACTIVATED")}>
                          <SubmitButton size="sm" variant="danger" confirm={`Remove ${s.name}'s staff access?`}>
                            Remove access
                          </SubmitButton>
                        </ActionForm>
                      ) : (
                        <ActionForm action={setUserStatusAction.bind(null, s.id, "ACTIVE")}>
                          <SubmitButton size="sm" variant="secondary">
                            Restore
                          </SubmitButton>
                        </ActionForm>
                      ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Add operations staff" />
            <div className="p-5">
              <PersonForm kind="STAFF" action={createPersonAction.bind(null, "OPERATIONS")} submitLabel="Add staff member" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
