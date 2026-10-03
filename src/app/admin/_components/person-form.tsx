import type { StudentProfile, TeacherProfile, User } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { COMMON_TIMEZONES } from "@/lib/time";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";

type Person = User & { teacherProfile?: TeacherProfile | null; studentProfile?: StudentProfile | null };

export const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "Cambridge", "State Board", "A-Level", "Other"];

export function PersonForm({
  kind,
  action,
  person,
  submitLabel,
}: {
  kind: "TEACHER" | "STUDENT" | "STAFF";
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  person?: Person;
  submitLabel: string;
}) {
  const sp = person?.studentProfile;
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" required defaultValue={person?.name} autoComplete="off" />
        </Field>
        <Field label="Google account email" hint="They sign in with this Google account. Never shown to teachers/students.">
          <Input name="email" type="email" required defaultValue={person?.email} autoComplete="off" placeholder="name@gmail.com" />
        </Field>
        {kind !== "STAFF" && (
          <Field label="Phone (private)" hint="Visible to Silora staff only.">
            <Input name="phone" defaultValue={person?.phone ?? ""} autoComplete="off" />
          </Field>
        )}
        <Field label="Timezone" hint="Class times are shown in this timezone. Leave as default for India.">
          <Select name="timezone" defaultValue={person?.timezone ?? ""}>
            <option value="">Academy default</option>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
        {kind === "TEACHER" && (
          <Field label="Title shown to students" hint='e.g. "Mathematics Teacher"'>
            <Input name="headline" defaultValue={person?.teacherProfile?.headline ?? ""} />
          </Field>
        )}
        {kind === "STUDENT" && (
          <>
            <Field label="Grade">
              <Input name="grade" defaultValue={sp?.grade ?? ""} placeholder="Grade 10" />
            </Field>
            <Field label="Board / curriculum">
              <Select name="board" defaultValue={sp?.board ?? ""}>
                <option value="">—</option>
                {BOARDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Parent / guardian name (private)">
              <Input name="guardianName" defaultValue={sp?.guardianName ?? ""} />
            </Field>
            <Field label="Parent / guardian phone (private)">
              <Input name="guardianPhone" defaultValue={sp?.guardianPhone ?? ""} />
            </Field>
            <Field label="Parent / guardian email (private)">
              <Input name="guardianEmail" type="email" defaultValue={sp?.guardianEmail ?? ""} />
            </Field>
          </>
        )}
      </div>
      {kind !== "STAFF" && (
        <Field label="Internal notes" hint="Staff only.">
          <Textarea name="notes" defaultValue={(kind === "TEACHER" ? person?.teacherProfile?.notes : sp?.notes) ?? ""} />
        </Field>
      )}
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
