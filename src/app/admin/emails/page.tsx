import type { Metadata } from "next";
import type { EmailStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { fmtDateTime } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Emails" };

const STATUS: Record<EmailStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  PENDING: { label: "Waiting to send", tone: "info" },
  SENT: { label: "Sent", tone: "success" },
  LOGGED: { label: "Not sent (local)", tone: "neutral" },
  SKIPPED: { label: "Skipped", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

/** Every email the app has sent or queued, newest first. */
export default async function EmailsPage() {
  const user = await requirePagePermission("people.view");
  const tz = user.timezone ?? user.org.timezone;
  const emails = await db.emailLog.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });
  const local = (process.env.EMAIL_DRIVER ?? "log") !== "resend";

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title="Emails" subtitle="Class changes and cancellations emailed to teachers and students. Newest first." />
      {local && (
        <div className="mb-4">
          <Notice tone="info">
            Email sending is off on this computer. Emails are listed here so you can read them, but nobody receives them. They are
            sent for real once Resend is connected.
          </Notice>
        </div>
      )}
      <Card>
        {emails.length === 0 ? (
          <EmptyState title="No emails yet" body="Cancel or move a lesson, or create a class, and its email appears here within a minute." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {emails.map((e) => (
              <li key={e.id}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 [&::-webkit-details-marker]:hidden">
                    <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy-900">{e.subject}</span>
                    <span className="text-sm text-slate-600">
                      {e.user?.name ?? e.toEmail} <span className="text-slate-400">· {e.toEmail}</span>
                    </span>
                    <span className="text-xs text-slate-500">{fmtDateTime(e.createdAt, tz)}</span>
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm text-slate-800">{e.text}</pre>
                  {e.error && <p className="mt-2 text-sm text-red-700">{e.error}</p>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
