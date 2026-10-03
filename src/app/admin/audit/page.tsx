import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { fmtDateTime } from "@/lib/time";
import { Input, Select } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 100;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const user = await requirePagePermission("audit.view");
  const sp = await searchParams;
  const action = typeof sp.action === "string" && sp.action ? sp.action : undefined;
  const result = sp.result === "DENIED" || sp.result === "FAILURE" || sp.result === "SUCCESS" ? sp.result : undefined;
  const actorQ = typeof sp.actor === "string" ? sp.actor.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const tz = user.timezone ?? user.org.timezone;

  const actorIds = actorQ
    ? (await db.user.findMany({ where: { orgId: user.orgId, OR: [{ name: { contains: actorQ, mode: "insensitive" } }, { email: { contains: actorQ, mode: "insensitive" } }] }, select: { id: true } })).map((u) => u.id)
    : undefined;

  const [logs, actions] = await Promise.all([
    db.auditLog.findMany({
      where: { orgId: user.orgId, action, result, actorId: actorIds ? { in: actorIds } : undefined },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE + 1,
    }),
    db.auditLog.findMany({ where: { orgId: user.orgId }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const actors = await db.user.findMany({
    where: { id: { in: [...new Set(logs.map((l) => l.actorId).filter(Boolean) as string[])] } },
    select: { id: true, name: true, role: true },
  });
  const actorName = new Map(actors.map((a) => [a.id, `${a.name} (${a.role.toLowerCase().replace("_", " ")})`]));
  const hasMore = logs.length > PAGE;

  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    q.set("page", String(p));
    return `?${q}`;
  };

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what, and when. Entries cannot be edited or deleted from the app." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="actor" defaultValue={actorQ} placeholder="Actor name or email" className="max-w-xs" />
        <Select name="action" defaultValue={action ?? ""} className="max-w-[240px]">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action}>{a.action}</option>
          ))}
        </Select>
        <Select name="result" defaultValue={result ?? ""} className="max-w-[160px]">
          <option value="">All results</option>
          <option value="SUCCESS">Success</option>
          <option value="DENIED">Denied</option>
          <option value="FAILURE">Failure</option>
        </Select>
        <button className="rounded-full bg-navy-800 px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <Card>
        {logs.length === 0 ? (
          <EmptyState title="No entries" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Result</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, PAGE).map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt, tz)}</Td>
                  <Td className="text-xs">{l.actorId ? actorName.get(l.actorId) ?? l.actorId : "System"}</Td>
                  <Td className="font-mono text-xs font-semibold text-navy-900">{l.action}</Td>
                  <Td className="text-xs text-slate-600">
                    {l.targetType ? `${l.targetType} ${l.targetId?.slice(-8)}` : "—"}
                    {l.metadata && <span className="block max-w-xs truncate font-mono text-[11px] text-slate-400">{JSON.stringify(l.metadata)}</span>}
                  </Td>
                  <Td>
                    <Badge tone={l.result === "SUCCESS" ? "success" : l.result === "DENIED" ? "danger" : "warning"}>{l.result.toLowerCase()}</Badge>
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-500">{l.ip ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="mt-4 flex justify-between text-sm font-semibold">
        {page > 1 ? <a href={qs(page - 1)} className="text-gold-700 hover:underline">← Newer</a> : <span />}
        {hasMore && <a href={qs(page + 1)} className="text-gold-700 hover:underline">Older →</a>}
      </div>
    </>
  );
}
