import Link from "next/link";
import type { Alert } from "@prisma/client";
import { fmtDateTime } from "@/lib/time";
import { updateAlertAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, cx } from "@/components/ui";

const SEVERITY_TONE = { CRITICAL: "danger", WARNING: "warning", INFO: "info" } as const;

export function AlertList({ alerts, timeZone, compact }: { alerts: Alert[]; timeZone: string; compact?: boolean }) {
  if (!alerts.length) return <EmptyState title="No open alerts" body="Everything is running normally." />;
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map((a) => (
        <li key={a.id} className={cx("px-5 py-4", a.status === "RESOLVED" && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
            {a.status !== "OPEN" && <Badge>{a.status === "ACKNOWLEDGED" ? "Acknowledged" : "Resolved"}</Badge>}
            <span className="text-xs text-slate-500">{fmtDateTime(a.createdAt, timeZone)}</span>
          </div>
          <p className="mt-1.5 font-semibold text-navy-900">{a.title}</p>
          {a.details && <p className={cx("mt-0.5 text-sm text-slate-600", compact && "line-clamp-2")}>{a.details}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {a.sessionId && (
              <Link href={`/admin/sessions/${a.sessionId}`} className="text-xs font-semibold text-gold-700 hover:underline">
                Open lesson
              </Link>
            )}
            {!a.sessionId && a.courseId && (
              <Link href={`/admin/classes/${a.courseId}`} className="text-xs font-semibold text-gold-700 hover:underline">
                Open class
              </Link>
            )}
            {a.type === "MESSAGE_FLAGGED" && (
              <Link href="/admin/moderation" className="text-xs font-semibold text-gold-700 hover:underline">
                Review messages
              </Link>
            )}
            <div className="flex-1" />
            {a.status === "OPEN" && (
              <ActionForm action={updateAlertAction.bind(null, a.id, "ACKNOWLEDGED")}>
                <SubmitButton variant="ghost" size="sm">
                  Acknowledge
                </SubmitButton>
              </ActionForm>
            )}
            {a.status !== "RESOLVED" && (
              <ActionForm action={updateAlertAction.bind(null, a.id, "RESOLVED")}>
                <SubmitButton variant="secondary" size="sm">
                  Resolve
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
