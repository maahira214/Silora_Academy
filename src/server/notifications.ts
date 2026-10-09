import "server-only";
import { db } from "@/lib/db";
import { queueEmails } from "@/server/email";

/**
 * In-app notifications. Text is deliberately generic so nothing sensitive
 * appears on lock screens or in previews ("New message from your Silora teacher").
 */
export async function notify(
  userIds: string[],
  n: { title: string; body: string; link?: string; dedupeKey?: string },
  /** `email: true` also emails it (class changes and cancellations only; see server/email.ts). */
  opts: { email?: boolean } = {},
) {
  if (opts.email) await queueEmails(userIds, n);
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await db.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      title: n.title,
      body: n.body,
      link: n.link,
      dedupeKey: n.dedupeKey ? `${n.dedupeKey}:${userId}` : undefined,
    })),
    skipDuplicates: true,
  });
}

export async function unreadNotificationCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}
