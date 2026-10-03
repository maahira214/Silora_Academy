import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { getThreadAccess, listMessages, threadTitle } from "@/server/chat";
import { ChatWindow } from "@/components/chat-window";
import { Card, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Conversation" };

export default async function ReviewThreadPage({ params }: PageProps<"/admin/moderation/thread/[id]">) {
  const user = await requirePagePermission("chat.review");
  const { id } = await params;
  const access = await getThreadAccess(user, id);
  if (!access) notFound();
  const messages = await listMessages(user, access);
  // Every staff view of a private conversation is recorded
  await audit({ orgId: user.orgId, actorId: user.id, action: "CHAT_VIEWED_BY_STAFF", targetType: "Thread", targetId: id });

  return (
    <>
      <PageHeader
        back={{ href: `/admin/classes/${access.thread.courseId}`, label: access.thread.course.title }}
        title={threadTitle(access.thread, "TEACHER")}
        subtitle="Read-only reviewer view"
      />
      <div className="mb-4">
        <Notice tone="info">Your access to this conversation is recorded in the audit log.</Notice>
      </div>
      <Card className="overflow-hidden">
        <ChatWindow threadId={id} initialMessages={messages} initialCanPost={false} initialReadOnlyReason={access.readOnlyReason} maxUploadMb={user.org.maxUploadMb} />
      </Card>
    </>
  );
}
