import Link from "next/link";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/time";
import { markAllNotificationsRead } from "@/app/notifications-actions";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";

export async function NotificationsPage({ user }: { user: CurrentUser }) {
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const tz = user.timezone ?? user.org.timezone;
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button className="text-sm font-semibold text-gold-700 hover:underline">Mark all as read</button>
            </form>
          )
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const body = (
                <div className={cx("flex gap-3 px-5 py-4", !n.readAt && "bg-gold-50/50")}>
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-gold-500")} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy-900">{n.title}</p>
                    <p className="text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.createdAt, tz)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={`/notifications/${n.id}`}>{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
