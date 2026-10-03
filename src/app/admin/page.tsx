import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/authz";
import { fmtDate, fmtTime, localDateKey, localDayRange, tzLabel } from "@/lib/time";
import { loadSessions } from "@/server/sessions";
import { AutoRefresh } from "@/components/auto-refresh";
import { SessionTable } from "@/components/session-table";
import { AlertList } from "@/components/alert-list";
import { ButtonLink, Card, CardHeader, PageHeader, StatTile } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

const ATTENTION = new Set(["TEACHER_NOT_JOINED", "STUDENT_NOT_JOINED", "NO_ONE_JOINED"]);
const IN_PROGRESS = new Set(["LIVE", "TEACHER_NOT_JOINED", "STUDENT_NOT_JOINED", "NO_ONE_JOINED", "OPEN"]);

export default async function AdminDashboard() {
  const user = await requirePageUser("SUPER_ADMIN", "OPERATIONS");
  const org = user.org;
  const tz = user.timezone ?? org.timezone;
  const now = new Date();
  const [dayStart, dayEnd] = localDayRange(localDateKey(now, tz), tz);

  const [today, alerts, alertCounts] = await Promise.all([
    loadSessions({ startsAt: { gte: dayStart, lt: dayEnd } }, org),
    db.alert.findMany({ where: { orgId: org.id, status: { not: "RESOLVED" } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: 8 }),
    db.alert.groupBy({ by: ["severity"], where: { orgId: org.id, status: "OPEN" }, _count: true }),
  ]);

  const active = today.filter((s) => s.status !== "CANCELLED");
  const attention = active.filter((s) => ATTENTION.has(s.live));
  const now_ = active.filter((s) => IN_PROGRESS.has(s.live));
  const upcoming = active.filter((s) => s.live === "SCHEDULED" || s.live === "UPCOMING");
  const completed = active.filter((s) => s.status === "COMPLETED" || s.live === "ENDED_PENDING");
  const openAlerts = alertCounts.reduce((n, a) => n + a._count, 0);
  const critical = alertCounts.find((a) => a.severity === "CRITICAL")?._count ?? 0;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Today"
        subtitle={`${fmtDate(now, tz)} · times in ${tzLabel(now, tz)} · refreshes automatically`}
        actions={
          <>
            <ButtonLink href="/admin/sessions" variant="secondary">
              Full schedule
            </ButtonLink>
            <ButtonLink href="/admin/classes/new">+ New class</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Today's classes" value={active.length} />
        <StatTile label="Upcoming" value={upcoming.length} />
        <StatTile label="In progress" value={now_.length} tone="success" />
        <StatTile label="Completed" value={completed.length} />
        <StatTile label="Open alerts" value={openAlerts} tone={openAlerts ? "warning" : undefined} href="/admin/alerts" />
        <StatTile label="Critical" value={critical} tone={critical ? "danger" : undefined} href="/admin/alerts?severity=CRITICAL" />
      </div>

      {attention.length > 0 && (
        <Card className="mt-6 ring-red-200">
          <CardHeader title={<span className="text-red-800">Needs attention now</span>} subtitle="Someone hasn't joined after the grace period" />
          <SessionTable sessions={attention} timeZone={tz} />
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Happening now" subtitle="Lessons open to join or in progress" />
          <SessionTable sessions={now_} timeZone={tz} empty="No lessons are in progress right now." />
        </Card>
        <Card>
          <CardHeader
            title="Alerts"
            action={
              <Link href="/admin/alerts" className="text-xs font-semibold text-gold-700 hover:underline">
                View all
              </Link>
            }
          />
          <AlertList alerts={alerts} timeZone={tz} compact />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Later today" subtitle={upcoming[0] ? `Next lesson at ${fmtTime(upcoming[0].startsAt, tz)}` : undefined} />
        <SessionTable sessions={upcoming} timeZone={tz} empty="No more lessons today." />
      </Card>
    </>
  );
}
