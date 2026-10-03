import type { Metadata } from "next";
import Link from "next/link";
import type { AlertSeverity, AlertStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { AlertList } from "@/components/alert-list";
import { AutoRefresh } from "@/components/auto-refresh";
import { Card, PageHeader, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Alerts" };

const STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
const SEVERITIES = ["CRITICAL", "WARNING", "INFO"] as const;

export default async function AlertsPage({ searchParams }: PageProps<"/admin/alerts">) {
  const user = await requirePagePermission("alerts.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) as AlertStatus | undefined;
  const severity = SEVERITIES.find((s) => s === sp.severity) as AlertSeverity | undefined;
  const tz = user.timezone ?? user.org.timezone;

  const alerts = await db.alert.findMany({
    where: { orgId: user.orgId, status: status ?? { not: "RESOLVED" }, severity },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const chip = (label: string, params: Record<string, string | undefined>, active: boolean) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return (
      <Link
        key={label}
        href={`/admin/alerts${q ? `?${q}` : ""}`}
        className={cx("rounded-full px-3 py-1.5 text-xs font-semibold ring-1", active ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50")}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title="Alerts" subtitle="Only exceptions show up here, so nobody has to watch every class." />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("Unresolved", { severity }, !status)}
        {STATUSES.map((s) => chip(s[0] + s.slice(1).toLowerCase(), { status: s, severity }, status === s))}
        <span className="mx-1 w-px bg-slate-300" />
        {chip("All severities", { status }, !severity)}
        {SEVERITIES.map((s) => chip(s[0] + s.slice(1).toLowerCase(), { status, severity: s }, severity === s))}
      </div>
      <Card>
        <AlertList alerts={alerts} timeZone={tz} />
      </Card>
    </>
  );
}
