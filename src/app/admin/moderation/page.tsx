import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/authz";
import { fmtDateTime } from "@/lib/time";
import { reviewMessageAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Chat review" };

export default async function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  const user = await requirePagePermission("chat.review");
  const sp = await searchParams;
  const showReviewed = sp.show === "reviewed";
  const tz = user.timezone ?? user.org.timezone;

  const messages = await db.message.findMany({
    where: { flagged: true, reviewedAt: showReviewed ? { not: null } : null, thread: { course: { orgId: user.orgId } } },
    include: { sender: { select: { name: true, role: true } }, thread: { include: { course: { select: { id: true, title: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Chat review"
        subtitle={`Messages flagged for possible contact-information sharing. Current policy: ${user.org.contactPolicy.toLowerCase()} (change in Settings).`}
        actions={
          <Link href={showReviewed ? "/admin/moderation" : "/admin/moderation?show=reviewed"} className="text-sm font-semibold text-gold-700 hover:underline">
            {showReviewed ? "Show pending" : "Show reviewed"}
          </Link>
        }
      />
      <Card>
        <CardHeader title={showReviewed ? "Reviewed" : "Waiting for review"} />
        {messages.length === 0 ? (
          <EmptyState title="Nothing to review" body="Flagged messages will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-navy-900">{m.sender.name}</span>
                  <span>({m.sender.role.toLowerCase()})</span>
                  <span>in</span>
                  <Link href={`/admin/classes/${m.thread.course.id}`} className="font-semibold text-navy-800 hover:underline">
                    {m.thread.course.title}
                  </Link>
                  <span>· {fmtDateTime(m.createdAt, tz)}</span>
                  <Badge tone={m.status === "VISIBLE" ? "warning" : m.status === "REMOVED" ? "neutral" : "danger"}>{m.status.toLowerCase()}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">{m.body || "(file only)"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.flagReasons.map((r) => (
                    <Badge key={r} tone="danger">
                      {r}
                    </Badge>
                  ))}
                  <div className="flex-1" />
                  <Link href={`/admin/moderation/thread/${m.threadId}`} className="text-xs font-semibold text-gold-700 hover:underline">
                    View conversation
                  </Link>
                  {!m.reviewedAt && (
                    <>
                      {m.status === "QUARANTINED" && (
                        <ActionForm action={reviewMessageAction.bind(null, m.id, "approve")}>
                          <SubmitButton size="sm" variant="secondary">
                            Approve & deliver
                          </SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={reviewMessageAction.bind(null, m.id, "dismiss")}>
                        <SubmitButton size="sm" variant="ghost">
                          {m.status === "VISIBLE" ? "OK, no action" : "Keep blocked"}
                        </SubmitButton>
                      </ActionForm>
                      {m.status !== "REMOVED" && (
                        <ActionForm action={reviewMessageAction.bind(null, m.id, "remove")}>
                          <SubmitButton size="sm" variant="danger" confirm="Remove this message for everyone?">
                            Remove message
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
