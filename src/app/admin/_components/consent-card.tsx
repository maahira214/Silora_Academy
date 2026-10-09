import type { StudentProfile, User } from "@prisma/client";
import { db } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/legal";
import { fmtDate, localDateKey } from "@/lib/time";
import { recordGuardianConsentAction, removeGuardianConsentAction } from "@/app/admin/actions";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader } from "@/components/ui";
import { CONSENT_METHODS } from "@/server/users";

/** Privacy status for a teacher or student: policy agreement, and for students the parent's consent. */
export async function ConsentCard({
  person,
  timeZone,
  canEdit,
}: {
  person: User & { studentProfile?: StudentProfile | null };
  timeZone: string;
  canEdit: boolean;
}) {
  const sp = person.studentProfile;
  const recordedBy = sp?.guardianConsentById
    ? await db.user.findUnique({ where: { id: sp.guardianConsentById }, select: { name: true } })
    : null;
  const agreed = person.policyVersion === POLICY_VERSION;

  return (
    <Card>
      <CardHeader title="Privacy and consent" />
      <div className="space-y-4 p-5 text-sm">
        <div>
          <p className="font-semibold text-slate-800">Privacy policy</p>
          {agreed ? (
            <p className="text-slate-600">
              <Badge tone="success">Agreed</Badge> on {fmtDate(person.policyAcceptedAt!, timeZone)}
            </p>
          ) : (
            <p className="text-slate-600">
              <Badge tone="warning">{person.policyVersion ? "Needs to agree to the new version" : "Not yet"}</Badge> They are asked at their next
              sign-in.
            </p>
          )}
        </div>

        {person.role === "STUDENT" && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="font-semibold text-slate-800">Parent or guardian consent</p>
            {sp?.guardianConsentAt ? (
              <>
                <p className="text-slate-600">
                  <Badge tone="success">Recorded</Badge> {sp.guardianConsentMethod}, {fmtDate(sp.guardianConsentAt, timeZone)}
                  {recordedBy && ` · recorded by ${recordedBy.name}`}
                </p>
                {canEdit && (
                  <ActionForm action={removeGuardianConsentAction.bind(null, person.id)}>
                    <SubmitButton variant="ghost" size="sm" confirm="Remove the recorded consent? Do this if the parent withdrew it.">
                      Remove (parent withdrew consent)
                    </SubmitButton>
                  </ActionForm>
                )}
              </>
            ) : (
              <>
                <p className="text-slate-600">
                  <Badge tone="danger">Not recorded</Badge> Needed for students under 18.{" "}
                  <a href="/privacy/parent-consent" target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline">
                    Consent form to send
                  </a>
                </p>
                {canEdit && (
                  <ActionForm action={recordGuardianConsentAction.bind(null, person.id)} className="space-y-3">
                    <Field label="How did they agree?">
                      <Select name="method" required defaultValue="">
                        <option value="" disabled>
                          Choose…
                        </option>
                        {CONSENT_METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date they agreed">
                      <Input type="date" name="date" required defaultValue={localDateKey(new Date(), timeZone)} max={localDateKey(new Date(), timeZone)} />
                    </Field>
                    <SubmitButton size="sm">Record consent</SubmitButton>
                  </ActionForm>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
