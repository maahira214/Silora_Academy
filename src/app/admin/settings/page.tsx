import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/authz";
import { googleConfigured } from "@/lib/auth/google";
import { googleMeetApiConfigured } from "@/lib/meet";
import { COMMON_TIMEZONES } from "@/lib/time";
import { updateSettingsAction } from "@/app/admin/actions";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePagePermission("settings.manage");
  const org = user.org;

  return (
    <>
      <PageHeader title="Settings" subtitle="Academy-wide rules for classes, alerts and messaging." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActionForm action={updateSettingsAction} className="space-y-6">
            <Card>
              <CardHeader title="Academy" />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Name">
                  <Input name="name" defaultValue={org.name} required />
                </Field>
                <Field label="Default timezone">
                  <Select name="timezone" defaultValue={org.timezone}>
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz}>{tz}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Classes & alerts" />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Join button opens (minutes before start)">
                  <Input type="number" name="joinOpensMinutesBefore" min={0} max={60} defaultValue={org.joinOpensMinutesBefore} />
                </Field>
                <Field label="Reminders (minutes before, comma-separated)" hint="e.g. 30, 10">
                  <Input name="reminderMinutesBefore" defaultValue={org.reminderMinutesBefore.join(", ")} />
                </Field>
                <Field label="Teacher grace period (minutes)" hint="CRITICAL alert if the teacher hasn't joined by then.">
                  <Input type="number" name="teacherGraceMinutes" min={1} max={60} defaultValue={org.teacherGraceMinutes} />
                </Field>
                <Field label="Student grace period (minutes)" hint="WARNING alert and the teacher is told.">
                  <Input type="number" name="studentGraceMinutes" min={1} max={60} defaultValue={org.studentGraceMinutes} />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="Messaging policy" />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="When contact details are detected" className="sm:col-span-2">
                  <Select name="contactPolicy" defaultValue={org.contactPolicy}>
                    <option value="WARN">Warn — deliver, warn the sender, flag for review</option>
                    <option value="FLAG">Flag — deliver silently, flag for review</option>
                    <option value="BLOCK">Block — don&apos;t deliver, tell the sender, flag for review</option>
                    <option value="QUARANTINE">Quarantine — hold until a Super Admin approves</option>
                  </Select>
                </Field>
                <Field label="Max file size (MB)">
                  <Input type="number" name="maxUploadMb" min={1} max={50} defaultValue={org.maxUploadMb} />
                </Field>
                <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold text-slate-800">
                  <input type="checkbox" name="allowPrivateGroupChat" defaultChecked={org.allowPrivateGroupChat} className="size-4 accent-navy-800" />
                  Allow private teacher ↔ student chats in group classes
                </label>
              </div>
            </Card>

            <div className="flex justify-end">
              <SubmitButton>Save settings</SubmitButton>
            </div>
          </ActionForm>
        </div>

        <Card>
          <CardHeader title="Integrations" />
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span>Google sign-in</span>
              <Badge tone={googleConfigured() ? "success" : "warning"}>{googleConfigured() ? "Configured" : "Not configured"}</Badge>
            </li>
            <li className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span>Google Meet API</span>
                <Badge tone={googleMeetApiConfigured() ? "success" : "neutral"}>{googleMeetApiConfigured() ? "Configured" : "Manual links"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Without it, staff paste a Meet link from Silora&apos;s Google account once per class. Auto-admission and Meet attendance data need
                a Google Workspace organizer account.
              </p>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
