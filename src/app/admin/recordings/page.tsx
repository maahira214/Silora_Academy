import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { RECORDING_KEEP_DAYS } from "@/lib/legal";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { confirmDriveDeletedAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Card, CardHeader, EmptyState, Notice, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Recordings" };

const include = { session: { include: { course: { include: { subject: true, teacher: { select: { name: true } } } } } } } as const;

/** All class recordings (Super Admins only), plus expired ones still to delete from Google Drive. */
export default async function RecordingsPage() {
  const user = await requirePagePermission("recordings.view");
  const tz = user.timezone ?? user.org.timezone;
  const [active, toDelete] = await Promise.all([
    db.recording.findMany({ where: { orgId: user.orgId, removedAt: null }, include, orderBy: { createdAt: "desc" }, take: 200 }),
    db.recording.findMany({ where: { orgId: user.orgId, removedAt: { not: null }, driveDeletedAt: null }, include, orderBy: { removedAt: "asc" } }),
  ]);
  const lesson = (r: (typeof active)[number]) =>
    `${r.session.course.title} · ${fmtDateTime(r.session.startsAt, tz)} · Teacher ${r.session.course.teacher.name}`;

  return (
    <>
      <PageHeader
        title="Class recordings"
        subtitle={`Only Super Admins can see recordings. Teachers and students can't. Each is kept for ${RECORDING_KEEP_DAYS} days.`}
      />
      <div className="mb-6">
        <Notice tone="info">
          Add a recording from the lesson&apos;s page (Schedule → a lesson → Recording). Once Silora&apos;s paid Google Meet plan is connected,
          recordings can be added automatically.
        </Notice>
      </div>

      {toDelete.length > 0 && (
        <Card className="mb-6 ring-2 ring-orange-200">
          <CardHeader
            title={<span className="text-orange-800">Delete from Google Drive ({toDelete.length})</span>}
            subtitle="These were removed from Silora. Delete each file from Silora's Google Drive, then tick it off here."
          />
          <ul className="divide-y divide-slate-100">
            {toDelete.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-navy-900">{lesson(r)}</span>
                  <span className="text-xs text-slate-500">{r.removedNote}</span>
                </span>
                <a href={r.url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                  Open in Drive to delete
                </a>
                <ActionForm action={confirmDriveDeletedAction.bind(null, r.id)}>
                  <SubmitButton size="sm">Deleted from Drive</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={`Recordings (${active.length})`} />
        {active.length === 0 ? (
          <EmptyState title="No recordings yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/sessions/${r.sessionId}`} className="block font-semibold text-navy-900 hover:underline">
                    {lesson(r)}
                  </Link>
                  <span className="text-xs text-slate-500">Removed from Silora on {fmtDate(r.expiresAt, tz)}</span>
                </span>
                <a href={`/admin/recordings/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass("navy", "sm")}>
                  <Icon name="video" className="size-4" /> Watch
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
