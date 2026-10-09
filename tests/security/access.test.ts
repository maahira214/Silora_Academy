/**
 * Security checklist from the specification (section 72, stage 7): wrong student, wrong
 * teacher, other academies, ended and removed relationships, suspended and deactivated
 * accounts, staff permissions, fake files and contact-detail leaks. Each test calls the
 * same server code the app uses, against a real database.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getCourseAccess } from "@/lib/authz";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { resetRateLimits } from "@/lib/rate-limit";
import { addOneOffSession, createCourse, endCourse, removeStudentFromGroup, replaceTeacher } from "@/server/courses";
import { getThreadAccess, listMessages, sendMessage } from "@/server/chat";
import { setUserStatus } from "@/server/users";
import { GET as join } from "@/app/join/[sessionId]/route";
import { GET as downloadFile } from "@/app/api/files/[id]/route";
import { makeOrg, makeUser, meetLink, png, reload, request, signInAs } from "./helpers";

const TZ = "Asia/Kolkata";
let admin: CurrentUser, ops: CurrentUser;
let rahul: CurrentUser, priya: CurrentUser; // teachers
let aarav: CurrentUser, sarah: CurrentUser, riya: CurrentUser; // students
let outsider: CurrentUser; // student at a different academy
let aaravMaths: { id: string }, sarahPhysics: { id: string }, group: { id: string };
let aaravLessonId: string;

const thread = async (courseId: string) => (await db.thread.findFirstOrThrow({ where: { courseId, kind: "COURSE" } })).id;
const newCourse = (teacherId: string, studentIds: string[], type: "ONE_TO_ONE" | "GROUP" = "ONE_TO_ONE", subjectName = "Mathematics") =>
  createCourse(admin, { type, subjectName, teacherId, studentIds, timezone: TZ, meetLink: meetLink() });
const lessonSoon = async (courseId: string) => (await addOneOffSession(admin, courseId, new Date(Date.now() + 5 * 60_000), 60)).id;
const joinAs = async (user: { id: string } | null, sessionId: string) => {
  await signInAs(user);
  return (await join(request(`/join/${sessionId}`), { params: Promise.resolve({ sessionId }) })).headers.get("location") ?? "";
};

beforeAll(async () => {
  const org = await makeOrg();
  admin = await makeUser(org.id, "SUPER_ADMIN", "Silora Admin");
  ops = await makeUser(org.id, "OPERATIONS", "Ops Desk");
  rahul = await makeUser(org.id, "TEACHER", "Rahul Verma");
  priya = await makeUser(org.id, "TEACHER", "Priya Nair");
  aarav = await makeUser(org.id, "STUDENT", "Aarav Mehta");
  sarah = await makeUser(org.id, "STUDENT", "Sarah Thomas");
  riya = await makeUser(org.id, "STUDENT", "Riya Sen");
  outsider = await makeUser((await makeOrg("Another Academy")).id, "STUDENT", "Other Student");

  aaravMaths = await newCourse(rahul.id, [aarav.id]);
  sarahPhysics = await newCourse(priya.id, [sarah.id], "ONE_TO_ONE", "Physics");
  group = await newCourse(rahul.id, [aarav.id, riya.id], "GROUP", "Chemistry");
  aaravLessonId = await lessonSoon(aaravMaths.id);
});

beforeEach(() => resetRateLimits());

describe("wrong student", () => {
  it("cannot see, message or join another student's class", async () => {
    expect(await getCourseAccess(sarah, aaravMaths.id)).toBeNull();
    expect(await getThreadAccess(sarah, await thread(aaravMaths.id))).toBeNull();
    await expect(sendMessage(sarah, await thread(aaravMaths.id), "hello")).rejects.toThrow(/can't message/);
    expect(await joinAs(sarah, aaravLessonId)).toContain("/join-status?reason=not_assigned");
  });

  it("the right student is let in and sent to the class's own Meet room", async () => {
    expect((await getCourseAccess(aarav, aaravMaths.id))?.as).toBe("student");
    const { meetUrl } = await db.course.findUniqueOrThrow({ where: { id: aaravMaths.id } });
    expect(await joinAs(aarav, aaravLessonId)).toBe(meetUrl);
  });

  it("cannot open a file shared in someone else's chat", async () => {
    const t = await thread(aaravMaths.id);
    await sendMessage(aarav, t, "", png());
    const { attachmentId } = await db.message.findFirstOrThrow({ where: { threadId: t, attachmentId: { not: null } }, orderBy: { createdAt: "desc" } });
    const get = async (u: { id: string } | null) => {
      await signInAs(u);
      return (await downloadFile(request(`/api/files/${attachmentId}`), { params: Promise.resolve({ id: attachmentId! }) })).status;
    };
    expect(await get(rahul)).toBe(200); // the class's teacher
    expect(await get(sarah)).toBe(404);
    expect(await get(priya)).toBe(404);
    expect(await get(outsider)).toBe(404);
    expect(await get(null)).toBe(401);
  });
});

describe("wrong teacher", () => {
  it("cannot see or join another teacher's class", async () => {
    expect(await getCourseAccess(priya, aaravMaths.id)).toBeNull();
    expect(await getThreadAccess(priya, await thread(aaravMaths.id))).toBeNull();
    expect(await joinAs(priya, aaravLessonId)).toContain("reason=not_assigned");
  });
});

describe("other academies", () => {
  it("a user from another academy can't find this academy's classes at all", async () => {
    expect(await getCourseAccess(outsider, aaravMaths.id)).toBeNull();
    expect(await getThreadAccess(outsider, await thread(aaravMaths.id))).toBeNull();
    expect(await joinAs(outsider, aaravLessonId)).toContain("reason=not_found");
  });
});

describe("ended and removed relationships", () => {
  it("removing a student from a group ends their access to it", async () => {
    const g = await newCourse(rahul.id, [aarav.id, riya.id], "GROUP", "Biology");
    expect((await getCourseAccess(riya, g.id))?.as).toBe("student");
    await removeStudentFromGroup(admin, g.id, riya.id);
    expect(await getCourseAccess(riya, g.id)).toBeNull();
    expect(await getThreadAccess(riya, await thread(g.id))).toBeNull();
  });

  it("an ended class becomes read-only and can't be joined", async () => {
    const c = await newCourse(rahul.id, [riya.id], "ONE_TO_ONE", "English");
    const lesson = await lessonSoon(c.id);
    await endCourse(admin, c.id, "Finished the course");
    const access = await getThreadAccess(riya, await thread(c.id));
    expect(access?.canPost).toBe(false);
    await expect(sendMessage(riya, await thread(c.id), "still there?")).rejects.toThrow(/read-only/);
    expect(await joinAs(riya, lesson)).toContain("reason=class_ended");
  });

  it("a replaced teacher loses the class; the new teacher gets a new class, chat and Meet link", async () => {
    const c = await newCourse(rahul.id, [sarah.id], "ONE_TO_ONE", "History");
    const fresh = await replaceTeacher(admin, c.id, priya.id, meetLink());
    expect(await getCourseAccess(rahul, fresh.id)).toBeNull();
    expect((await getCourseAccess(priya, fresh.id))?.as).toBe("teacher");
    expect((await getThreadAccess(rahul, await thread(c.id)))?.canPost).toBe(false);
    expect(await thread(fresh.id)).not.toBe(await thread(c.id));
  });
});

describe("suspended and deactivated accounts", () => {
  it("suspending someone signs them out everywhere", async () => {
    const s = await makeUser(admin.orgId, "STUDENT", "Kabir Malhotra");
    await signInAs(s);
    expect((await getCurrentUser())?.id).toBe(s.id);
    await setUserStatus(admin, s.id, "SUSPENDED");
    expect(await db.authSession.count({ where: { userId: s.id } })).toBe(0);
    // Even a session cookie created after suspension is not accepted
    await signInAs(s);
    expect(await getCurrentUser()).toBeNull();
  });

  it("deactivating a student ends their one-to-one class and cancels its future lessons", async () => {
    const s = await makeUser(admin.orgId, "STUDENT", "Meera Iyer");
    const c = await newCourse(rahul.id, [s.id], "ONE_TO_ONE", "Geography");
    await lessonSoon(c.id);
    await setUserStatus(admin, s.id, "DEACTIVATED");
    expect((await db.course.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ENDED");
    expect(await db.classSession.count({ where: { courseId: c.id, status: "SCHEDULED" } })).toBe(0);
  });

  it("suspending a teacher pauses messaging and alerts operations about their classes", async () => {
    const t = await makeUser(admin.orgId, "TEACHER", "Amit Shah");
    const c = await newCourse(t.id, [sarah.id], "ONE_TO_ONE", "Economics");
    await lessonSoon(c.id);
    await setUserStatus(admin, t.id, "SUSPENDED");
    expect((await getThreadAccess(sarah, await thread(c.id)))?.canPost).toBe(false);
    expect(await db.alert.count({ where: { courseId: c.id, type: "TEACHER_INACTIVE" } })).toBe(1);
  });
});

describe("staff permissions", () => {
  it("operations staff can't suspend people or read private chats", async () => {
    await expect(setUserStatus(ops, aarav.id, "SUSPENDED")).rejects.toThrow(/Super Admin/);
    expect(await getThreadAccess(ops, await thread(aaravMaths.id))).toBeNull();
  });

  it("a Super Admin can review chats but not post in them", async () => {
    const access = await getThreadAccess(admin, await thread(aaravMaths.id));
    expect(access?.as).toBe("reviewer");
    expect(access?.canPost).toBe(false);
  });
});

describe("fake and unsafe files", () => {
  it("rejects a program renamed to look like a PDF, disallowed types and oversized files", async () => {
    const t = await thread(aaravMaths.id);
    const exe = Buffer.from("MZ\x90\x00 this is a Windows program");
    await expect(sendMessage(aarav, t, "", new File([exe], "worksheet.pdf"))).rejects.toThrow(/doesn't match its type/);
    await expect(sendMessage(aarav, t, "", new File([exe], "game.exe"))).rejects.toThrow(/file type isn't allowed/);
    const big = Buffer.alloc((aarav.org.maxUploadMb + 1) * 1024 * 1024);
    big.set([0x89, 0x50, 0x4e, 0x47]);
    await expect(sendMessage(aarav, t, "", new File([big], "huge.png"))).rejects.toThrow(/smaller than/);
  });
});

describe("contact-detail leaks", () => {
  it("never shows anyone's email or phone number to the other side of a chat", async () => {
    const t = await thread(aaravMaths.id);
    await sendMessage(rahul, t, "Please finish questions 1 to 10.");
    const access = (await getThreadAccess(aarav, t))!;
    const shown = JSON.stringify(await listMessages(aarav, access));
    for (const u of [rahul, aarav]) {
      expect(shown).not.toContain(u.email);
      expect(shown).not.toContain(u.phone!);
    }
  });

  it("with the Block policy, a phone number is never delivered and is flagged for review", async () => {
    await db.organization.update({ where: { id: admin.orgId }, data: { contactPolicy: "BLOCK" } });
    const t = await thread(group.id);
    const sent = await sendMessage(await reload(riya.id), t, "WhatsApp me on 98765 43210");
    expect(sent.status).toBe("BLOCKED");
    const teacherSees = JSON.stringify(await listMessages(rahul, (await getThreadAccess(rahul, t))!));
    expect(teacherSees).not.toContain("98765");
    expect(await db.alert.count({ where: { type: "MESSAGE_FLAGGED", courseId: group.id } })).toBeGreaterThan(0);
    await db.organization.update({ where: { id: admin.orgId }, data: { contactPolicy: "WARN" } });
  });
});

describe("flood limits", () => {
  it("stops a user sending more than 30 messages a minute", async () => {
    const t = await thread(sarahPhysics.id);
    for (let i = 0; i < 30; i++) await sendMessage(sarah, t, `question ${i}`);
    await expect(sendMessage(sarah, t, "one more")).rejects.toThrow(/very fast/);
  });
});
