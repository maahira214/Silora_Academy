import "server-only";
import { db } from "@/lib/db";
import { renderEmail } from "@/lib/email-template";

/**
 * Email notifications, sent through an outbox:
 *   1. queueEmails() stores the email when something happens (fast, never fails the action),
 *   2. deliverPendingEmails() sends it on the next class-monitor tick, with retries.
 *
 * EMAIL_DRIVER="log" (default, development) never sends anything: emails are marked LOGGED
 * and can be read under Admin → More → Emails.
 * EMAIL_DRIVER="resend" (production) sends through Resend with RESEND_API_KEY and EMAIL_FROM.
 * EMAIL_DAILY_LIMIT (default 95) keeps us inside Resend's free 100 emails a day; anything over
 * is SKIPPED, and people still get the in-app notification.
 */

const MAX_ATTEMPTS = 5;
const BATCH = 20;

export async function queueEmails(userIds: string[], n: { title: string; body: string; link?: string; dedupeKey?: string }) {
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(userIds)] }, status: "ACTIVE" },
    select: { id: true, orgId: true, name: true, email: true },
  });
  if (!users.length) return;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await db.emailLog.createMany({
    data: users.map((u) => {
      const e = renderEmail({ name: u.name, title: n.title, body: n.body, url: `${appUrl}${n.link ?? "/"}` });
      return {
        orgId: u.orgId,
        userId: u.id,
        toEmail: u.email,
        subject: e.subject,
        text: e.text,
        html: e.html,
        dedupeKey: n.dedupeKey ? `${n.dedupeKey}:${u.id}` : undefined,
      };
    }),
    skipDuplicates: true,
  });
}

type Sender = (email: { to: string; subject: string; text: string; html: string }) => Promise<{ id?: string }>;

const resendSender: Sender = async (email) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("EMAIL_DRIVER=resend needs RESEND_API_KEY and EMAIL_FROM");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { id?: string };
};

/** Called every minute by the class monitor. Returns how many emails were handled. */
export async function deliverPendingEmails(now = new Date(), opts: { driver?: string; send?: Sender; dailyLimit?: number } = {}) {
  const driver = opts.driver ?? process.env.EMAIL_DRIVER ?? "log";
  const pending = await db.emailLog.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: BATCH });
  if (!pending.length) return 0;

  if (driver !== "resend") {
    await db.emailLog.updateMany({ where: { id: { in: pending.map((e) => e.id) } }, data: { status: "LOGGED", sentAt: now } });
    return pending.length;
  }

  const send = opts.send ?? resendSender;
  const limit = opts.dailyLimit ?? Number(process.env.EMAIL_DAILY_LIMIT ?? 95);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let sentToday = await db.emailLog.count({ where: { status: "SENT", sentAt: { gte: dayStart } } });

  for (const e of pending) {
    if (sentToday >= limit) {
      await db.emailLog.update({ where: { id: e.id }, data: { status: "SKIPPED", error: `Daily email limit (${limit}) reached` } });
      continue;
    }
    try {
      const r = await send({ to: e.toEmail, subject: e.subject, text: e.text, html: e.html });
      await db.emailLog.update({ where: { id: e.id }, data: { status: "SENT", sentAt: now, providerId: r.id ?? null, attempts: { increment: 1 }, error: null } });
      sentToday++;
    } catch (err) {
      const attempts = e.attempts + 1;
      await db.emailLog.update({
        where: { id: e.id },
        data: { attempts, error: String((err as Error).message ?? err).slice(0, 500), status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING" },
      });
    }
  }
  return pending.length;
}
