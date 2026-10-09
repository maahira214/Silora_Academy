import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { addOneOffSession, cancelSession, createCourse } from "@/server/courses";
import { deliverPendingEmails, queueEmails } from "@/server/email";
import { makeOrg, makeUser, meetLink } from "./helpers";

let admin: CurrentUser, teacher: CurrentUser, student: CurrentUser;

beforeAll(async () => {
  const org = await makeOrg("Email Test Academy");
  admin = await makeUser(org.id, "SUPER_ADMIN", "Email Admin");
  teacher = await makeUser(org.id, "TEACHER", "Email Teacher");
  student = await makeUser(org.id, "STUDENT", "Email Student");
});

// Each test starts with an empty outbox
beforeEach(async () => {
  await db.emailLog.deleteMany({});
});

describe("class change emails", () => {
  it("cancelling a lesson emails the teacher and the student, without the Meet link", async () => {
    const link = meetLink();
    const c = await createCourse(admin, { type: "ONE_TO_ONE", subjectName: "Algebra", teacherId: teacher.id, studentIds: [student.id], timezone: "Asia/Kolkata", meetLink: link });
    const lesson = await addOneOffSession(admin, c.id, new Date(Date.now() + 86_400_000), 60);
    await db.emailLog.deleteMany({});

    await cancelSession(admin, lesson.id, "Teacher unwell");
    const emails = await db.emailLog.findMany();
    expect(emails.map((e) => e.toEmail).sort()).toEqual([student.email, teacher.email].sort());
    for (const e of emails) {
      expect(e.subject).toBe("Lesson cancelled · Silora Academy");
      expect(e.text).toContain("Reason: Teacher unwell.");
      expect(e.status).toBe("PENDING");
      expect(e.text + e.html).not.toContain(link.replace("https://", ""));
    }
  });

  it("the same event is never emailed twice", async () => {
    await queueEmails([student.id], { title: "Lesson cancelled", body: "x", dedupeKey: "cancelled:abc" });
    await queueEmails([student.id], { title: "Lesson cancelled", body: "x", dedupeKey: "cancelled:abc" });
    expect(await db.emailLog.count()).toBe(1);
  });
});

describe("delivery", () => {
  it("on this computer, emails are kept as LOGGED and nothing is sent", async () => {
    await queueEmails([student.id], { title: "Hello", body: "Test" });
    const send = vi.fn();
    expect(await deliverPendingEmails(new Date(), { driver: "log", send })).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect((await db.emailLog.findFirstOrThrow()).status).toBe("LOGGED");
  });

  it("in production, sends through the provider and records the result", async () => {
    await queueEmails([student.id, teacher.id], { title: "Hello", body: "Test" });
    const send = vi.fn(async () => ({ id: "re_123" }));
    await deliverPendingEmails(new Date(), { driver: "resend", send, dailyLimit: 95 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await db.emailLog.count({ where: { status: "SENT", providerId: "re_123" } })).toBe(2);
  });

  it("stops at the daily limit instead of going over the free plan", async () => {
    await queueEmails([student.id, teacher.id], { title: "Hello", body: "Test" });
    const send = vi.fn(async () => ({ id: "re_1" }));
    await deliverPendingEmails(new Date(), { driver: "resend", send, dailyLimit: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await db.emailLog.count({ where: { status: "SKIPPED" } })).toBe(1);
  });

  it("retries a failing send, then gives up after 5 attempts", async () => {
    await queueEmails([student.id], { title: "Hello", body: "Test" });
    const send = vi.fn(async () => {
      throw new Error("Resend 503: unavailable");
    });
    for (let i = 0; i < 4; i++) await deliverPendingEmails(new Date(), { driver: "resend", send, dailyLimit: 95 });
    expect((await db.emailLog.findFirstOrThrow()).status).toBe("PENDING");
    await deliverPendingEmails(new Date(), { driver: "resend", send, dailyLimit: 95 });
    const e = await db.emailLog.findFirstOrThrow();
    expect(e.status).toBe("FAILED");
    expect(e.attempts).toBe(5);
    expect(e.error).toContain("503");
  });
});
