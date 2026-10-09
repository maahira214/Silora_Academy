import "server-only";
import { extname } from "node:path";
import type { MessageStatus, Thread } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { UserError } from "@/lib/action-result";
import type { CurrentUser } from "@/lib/auth/session";
import { can, isStaffRole } from "@/lib/authz";
import { detectContactInfo, FINDING_LABELS } from "@/lib/moderation";
import { LIMITS, rateLimit, retryText } from "@/lib/rate-limit";
import { notify } from "@/server/notifications";
import { ALLOWED_UPLOADS, contentMatchesExtension, putObject } from "@/server/storage";

/**
 * Teacher ↔ student messaging. Every message goes through here so Silora can
 * enforce the relationship, moderation, audit and notifications. Access is
 * derived from the *current* assignment on every call — never cached.
 */

const threadInclude = {
  course: {
    include: {
      subject: true,
      teacher: { select: { id: true, name: true, status: true, teacherProfile: { select: { headline: true } } } },
      students: { where: { status: "ACTIVE" as const }, include: { student: { select: { id: true, name: true, status: true } } } },
    },
  },
} as const;

type ThreadWithCourse = NonNullable<Awaited<ReturnType<typeof loadThread>>>;

const loadThread = (threadId: string, orgId: string) =>
  db.thread.findFirst({ where: { id: threadId, course: { orgId } }, include: threadInclude });

export type ThreadAccess = {
  thread: ThreadWithCourse;
  as: "teacher" | "student" | "reviewer";
  canPost: boolean;
  readOnlyReason?: string;
};

export async function getThreadAccess(user: CurrentUser, threadId: string): Promise<ThreadAccess | null> {
  const thread = await loadThread(threadId, user.orgId);
  if (!thread) return null;
  const { course } = thread;

  let as: ThreadAccess["as"] | null = null;
  if (isStaffRole(user.role)) as = can(user, "chat.review") ? "reviewer" : null;
  else if (user.role === "TEACHER" && course.teacherId === user.id) as = "teacher";
  else if (user.role === "STUDENT") {
    const enrolled = course.students.some((s) => s.studentId === user.id);
    if (enrolled && (thread.kind === "COURSE" || thread.studentId === user.id)) as = "student";
  }
  if (!as) return null;

  let readOnlyReason: string | undefined;
  if (as === "reviewer") readOnlyReason = "You are viewing this conversation as a Silora reviewer.";
  else if (course.status !== "ACTIVE") readOnlyReason = "This class has ended. The conversation is read-only.";
  else if (thread.status !== "ACTIVE") readOnlyReason = "This conversation is closed.";
  else if (!course.chatEnabled) readOnlyReason = "Silora has paused messaging for this class.";
  else if (course.teacher.status !== "ACTIVE") readOnlyReason = "Messaging is paused while Silora updates this class.";

  return { thread, as, canPost: !readOnlyReason, readOnlyReason };
}

/** How a person is shown to the other side — name and role only, never contact details. */
export function displayIdentity(
  person: { name: string; teacherProfile?: { headline: string | null } | null },
  role: "TEACHER" | "STUDENT" | string,
  subjectName?: string,
) {
  if (role === "TEACHER") return `${person.name} — ${person.teacherProfile?.headline || `${subjectName ?? ""} Teacher`.trim()}`;
  if (role === "STUDENT") return `${person.name} — Student`;
  return `${person.name} — Silora Academy`;
}

export function threadTitle(thread: ThreadWithCourse | (Thread & { course: ThreadWithCourse["course"] }), viewerRole: string) {
  const c = thread.course;
  if (thread.kind === "PRIVATE") {
    const student = c.students.find((s) => s.studentId === thread.studentId)?.student;
    return viewerRole === "STUDENT" ? `${c.teacher.name} (private)` : `${student?.name ?? "Student"} (private) · ${c.subject.name}`;
  }
  if (c.type === "ONE_TO_ONE") {
    if (viewerRole === "STUDENT") return `${c.teacher.name} · ${c.subject.name}`;
    return `${c.students[0]?.student.name ?? "Student"} · ${c.subject.name}`;
  }
  return c.title;
}

/** Every conversation a teacher/student can open, with unread counts. */
export async function threadsForUser(user: CurrentUser) {
  const where =
    user.role === "TEACHER"
      ? { course: { orgId: user.orgId, teacherId: user.id } }
      : {
          course: { orgId: user.orgId, students: { some: { studentId: user.id, status: "ACTIVE" as const } } },
          OR: [{ kind: "COURSE" as const }, { kind: "PRIVATE" as const, studentId: user.id }],
        };

  const threads = await db.thread.findMany({
    where: { ...where, status: { not: "DISABLED" } },
    include: {
      ...threadInclude,
      reads: { where: { userId: user.id } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, where: { status: "VISIBLE" } },
    },
  });

  const rows = await Promise.all(
    threads.map(async (t) => {
      const lastReadAt = t.reads[0]?.lastReadAt ?? new Date(0);
      const unread = await db.message.count({
        where: { threadId: t.id, status: "VISIBLE", senderId: { not: user.id }, createdAt: { gt: lastReadAt } },
      });
      return {
        id: t.id,
        title: threadTitle(t, user.role),
        courseId: t.courseId,
        courseActive: t.course.status === "ACTIVE",
        kind: t.kind,
        lastMessage: t.messages[0] ?? null,
        unread,
      };
    }),
  );
  return rows.sort((a, b) => {
    if (a.courseActive !== b.courseActive) return a.courseActive ? -1 : 1;
    return (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0);
  });
}

export async function totalUnread(user: CurrentUser) {
  if (user.role !== "TEACHER" && user.role !== "STUDENT") return 0;
  const threads = await threadsForUser(user);
  return threads.reduce((n, t) => n + t.unread, 0);
}

export type MessageDTO = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: string;
  status: MessageStatus;
  notice?: string;
  attachment?: { id: string; fileName: string; mimeType: string; sizeBytes: number };
};

export async function listMessages(user: CurrentUser, access: ThreadAccess, opts: { after?: Date; limit?: number } = {}) {
  const reviewer = access.as === "reviewer";
  const messages = await db.message.findMany({
    where: {
      threadId: access.thread.id,
      createdAt: opts.after ? { gt: opts.after } : undefined,
      // Senders see their own blocked/held messages; reviewers see everything
      OR: reviewer ? undefined : [{ status: { in: ["VISIBLE", "REMOVED"] } }, { senderId: user.id }],
    },
    include: {
      sender: { select: { id: true, name: true, role: true, teacherProfile: { select: { headline: true } } } },
      attachment: true,
    },
    orderBy: { createdAt: opts.after ? "asc" : "desc" },
    take: opts.limit ?? 200,
  });
  if (!opts.after) messages.reverse();

  return messages.map<MessageDTO>((m) => {
    const removed = m.status === "REMOVED" && !reviewer;
    return {
      id: m.id,
      body: removed ? "" : m.body,
      createdAt: m.createdAt.toISOString(),
      mine: m.senderId === user.id,
      sender: displayIdentity(m.sender, m.sender.role, access.thread.course.subject.name),
      status: m.status,
      notice: noticeFor(m.status, m.flagged, m.senderId === user.id, reviewer, m.flagReasons),
      attachment: m.attachment && !removed
        ? { id: m.attachment.id, fileName: m.attachment.fileName, mimeType: m.attachment.mimeType, sizeBytes: m.attachment.sizeBytes }
        : undefined,
    };
  });
}

function noticeFor(status: MessageStatus, flagged: boolean, mine: boolean, reviewer: boolean, reasons: string[]) {
  if (reviewer && flagged) return `Flagged: ${reasons.join(", ")}`;
  if (status === "REMOVED") return "This message was removed by Silora Academy.";
  if (!mine) return undefined;
  if (status === "BLOCKED") return "Not delivered — personal contact details can't be shared on Silora.";
  if (status === "QUARANTINED") return "Held for review by Silora before delivery.";
  if (flagged) return "Reminder: please keep all communication on Silora. This message was flagged for review.";
  return undefined;
}

export async function sendMessage(user: CurrentUser, threadId: string, body: string, file?: File | null) {
  const access = await getThreadAccess(user, threadId);
  if (!access) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "MESSAGE_SEND", targetType: "Thread", targetId: threadId, result: "DENIED" });
    throw new UserError("You can't message in this conversation.");
  }
  if (!access.canPost) throw new UserError(access.readOnlyReason ?? "This conversation is read-only.");

  const text = body.trim();
  const hasFile = !!file && file.size > 0;
  if (!text && !hasFile) throw new UserError("Write a message or attach a file.");
  if (text.length > 4000) throw new UserError("Message is too long (max 4000 characters).");

  const sent = rateLimit(`message:${user.id}`, LIMITS.message);
  if (!sent.ok) throw new UserError(`You're sending messages very fast. Please wait and try again ${retryText(sent.retryAfterMs)}.`);
  if (hasFile) {
    const up = rateLimit(`upload:${user.id}`, LIMITS.upload);
    if (!up.ok) throw new UserError(`You've sent a lot of files. Please try again ${retryText(up.retryAfterMs)}.`);
  }

  const org = user.org;
  let attachmentId: string | undefined;
  if (hasFile) {
    const ext = extname(file!.name).toLowerCase();
    const allowed = ALLOWED_UPLOADS[ext];
    if (!allowed) throw new UserError("That file type isn't allowed. Use images, PDF, Word, PowerPoint or Excel files.");
    if (file!.size > org.maxUploadMb * 1024 * 1024) throw new UserError(`Files must be smaller than ${org.maxUploadMb} MB.`);
    const buf = Buffer.from(await file!.arrayBuffer());
    if (!contentMatchesExtension(buf, ext)) throw new UserError("The file content doesn't match its type.");
    const storageKey = await putObject(buf, ext);
    const att = await db.attachment.create({
      data: { uploaderId: user.id, fileName: file!.name.slice(0, 200), mimeType: allowed.mime, sizeBytes: file!.size, storageKey },
    });
    attachmentId = att.id;
  }

  // Contact-information detection (text + file name)
  const findings = detectContactInfo(`${text}\n${hasFile ? file!.name : ""}`);
  const flagged = findings.length > 0;
  let status: MessageStatus = "VISIBLE";
  if (flagged && org.contactPolicy === "BLOCK") status = "BLOCKED";
  if (flagged && org.contactPolicy === "QUARANTINE") status = "QUARANTINED";

  const message = await db.message.create({
    data: {
      threadId,
      senderId: user.id,
      body: text,
      attachmentId,
      status,
      flagged,
      flagReasons: findings.map((f) => FINDING_LABELS[f]),
    },
  });
  await db.threadRead.upsert({
    where: { threadId_userId: { threadId, userId: user.id } },
    update: { lastReadAt: message.createdAt },
    create: { threadId, userId: user.id, lastReadAt: message.createdAt },
  });

  if (attachmentId) {
    await audit({ orgId: user.orgId, actorId: user.id, action: "FILE_UPLOADED", targetType: "Attachment", targetId: attachmentId, metadata: { threadId } });
  }
  if (flagged) {
    await audit({
      orgId: user.orgId,
      actorId: user.id,
      action: "MESSAGE_FLAGGED",
      targetType: "Message",
      targetId: message.id,
      metadata: { findings, policy: org.contactPolicy },
    });
    await db.alert.create({
      data: {
        orgId: user.orgId,
        courseId: access.thread.courseId,
        type: "MESSAGE_FLAGGED",
        severity: "WARNING",
        title: "Possible contact-information sharing",
        details: `${user.name} (${user.role.toLowerCase()}) in "${access.thread.course.title}": ${findings.map((f) => FINDING_LABELS[f]).join(", ")}.`,
        dedupeKey: `message_flagged:${message.id}`,
      },
    });
  }

  if (status === "VISIBLE") await notifyRecipients(user, access.thread);

  return {
    status,
    warning:
      flagged && status === "VISIBLE" && org.contactPolicy === "WARN"
        ? "Personal contact details shouldn't be shared. Silora has been notified."
        : undefined,
  };
}

async function notifyRecipients(sender: CurrentUser, thread: ThreadWithCourse) {
  const c = thread.course;
  let recipients: string[];
  if (thread.kind === "PRIVATE") recipients = [c.teacherId, thread.studentId!];
  else recipients = [c.teacherId, ...c.students.map((s) => s.studentId)];
  recipients = recipients.filter((id) => id !== sender.id);

  // Only one unread "new message" notification per conversation per person
  const existing = await db.notification.findMany({
    where: { userId: { in: recipients }, readAt: null, link: `/messages/${thread.id}` },
    select: { userId: true },
  });
  const already = new Set(existing.map((n) => n.userId));
  const fresh = recipients.filter((id) => !already.has(id));
  if (!fresh.length) return;
  await notify(fresh, {
    title: sender.role === "TEACHER" ? "New message from your Silora teacher" : "New message from your Silora student",
    body: "Open Silora to read it.",
    link: `/messages/${thread.id}`,
  });
}

export async function markThreadRead(user: CurrentUser, threadId: string) {
  const now = new Date();
  await db.threadRead.upsert({
    where: { threadId_userId: { threadId, userId: user.id } },
    update: { lastReadAt: now },
    create: { threadId, userId: user.id, lastReadAt: now },
  });
  await db.notification.updateMany({ where: { userId: user.id, link: `/messages/${threadId}`, readAt: null }, data: { readAt: now } });
}

/** Private teacher↔student thread inside a group class (if Silora policy allows). */
export async function openPrivateThread(user: CurrentUser, courseId: string, studentId: string) {
  if (!user.org.allowPrivateGroupChat) throw new UserError("Private messages in group classes are turned off by Silora.");
  const course = await db.course.findFirst({
    where: { id: courseId, orgId: user.orgId, type: "GROUP", status: "ACTIVE" },
    include: { students: { where: { status: "ACTIVE" } } },
  });
  if (!course) throw new UserError("Class not found.");
  const isTeacher = user.role === "TEACHER" && course.teacherId === user.id;
  const isThatStudent = user.role === "STUDENT" && user.id === studentId;
  if (!(isTeacher || isThatStudent) || !course.students.some((s) => s.studentId === studentId)) {
    throw new UserError("You can't open this conversation.");
  }
  const existing = await db.thread.findFirst({ where: { courseId, kind: "PRIVATE", studentId } });
  if (existing) return existing;
  return db.thread.create({ data: { courseId, kind: "PRIVATE", studentId } });
}

/* ---------- moderation (staff) ---------- */

export async function reviewMessage(user: CurrentUser, messageId: string, decision: "approve" | "remove" | "dismiss") {
  if (!can(user, "chat.review")) throw new UserError("You don't have permission to review messages.");
  const m = await db.message.findFirst({ where: { id: messageId, thread: { course: { orgId: user.orgId } } }, include: { thread: { include: threadInclude } } });
  if (!m) throw new UserError("Message not found.");
  const status: MessageStatus = decision === "remove" ? "REMOVED" : decision === "approve" ? "VISIBLE" : m.status;
  await db.message.update({ where: { id: m.id }, data: { status, reviewedAt: new Date(), reviewedById: user.id } });
  await db.alert.updateMany({
    where: { dedupeKey: `message_flagged:${m.id}`, status: { not: "RESOLVED" } },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: user.id },
  });
  await audit({ orgId: user.orgId, actorId: user.id, action: `MESSAGE_REVIEW_${decision.toUpperCase()}`, targetType: "Message", targetId: m.id });
  if (decision === "approve" && m.status === "QUARANTINED") {
    const sender = await db.user.findUniqueOrThrow({ where: { id: m.senderId }, include: { org: true } });
    await notifyRecipients(sender, m.thread);
  }
}
