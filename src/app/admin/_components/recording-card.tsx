import { db } from "@/lib/db";
import { RECORDING_KEEP_DAYS } from "@/lib/legal";
import { fmtDate } from "@/lib/time";
import { addRecordingAction, removeRecordingAction } from "@/app/admin/actions";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Card, CardHeader, buttonClass } from "@/components/ui";

/** Recordings of one lesson. Only rendered for Super Admins ("recordings.view"). */
export async function RecordingCard({ sessionId, timeZone, lessonStarted }: { sessionId: string; timeZone: string; lessonStarted: boolean }) {
  const recordings = await db.recording.findMany({ where: { sessionId, removedAt: null }, orderBy: { createdAt: "asc" } });
  return (
    <Card>
      <CardHeader title="Recording" subtitle="Only Super Admins can see this. Teachers and students can't." />
      <div className="space-y-4 p-5 text-sm">
        {recordings.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            {/* Opens through Silora so every viewing is recorded in the audit log */}
            <a href={`/admin/recordings/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass("navy", "sm")}>
              <Icon name="video" className="size-4" /> Watch{recordings.length > 1 ? ` part ${i + 1}` : ""}
            </a>
            <span className="text-xs text-slate-500">Removed from Silora on {fmtDate(r.expiresAt, timeZone)}</span>
            <ActionForm action={removeRecordingAction.bind(null, r.id)}>
              <SubmitButton variant="ghost" size="sm" confirm="Remove this recording from Silora now? Delete it from Google Drive too.">
                Remove
              </SubmitButton>
            </ActionForm>
          </div>
        ))}
        {recordings.length === 0 && <p className="text-slate-600">{lessonStarted ? "No recording added for this lesson." : "Add the recording after the lesson."}</p>}
        {lessonStarted && (
          <ActionForm action={addRecordingAction.bind(null, sessionId)} resetOnSuccess className="space-y-2">
            <Input name="url" required placeholder="https://drive.google.com/file/d/…" aria-label="Google Drive link of the recording" />
            <p className="text-xs text-slate-500">
              Paste the Google Drive link of the recording (in Silora&apos;s account, not shared publicly). It is kept for {RECORDING_KEEP_DAYS} days.
            </p>
            <SubmitButton size="sm" variant="secondary">
              Add recording
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </Card>
  );
}
