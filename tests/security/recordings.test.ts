import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { RECORDING_KEEP_DAYS } from "@/lib/legal";
import { addOneOffSession, createCourse } from "@/server/courses";
import { addRecording, confirmDriveDeleted, expireRecordings, openRecording } from "@/server/recordings";
import { GET as openRoute } from "@/app/admin/recordings/[id]/route";
import { makeOrg, makeUser, meetLink, request, signInAs } from "./helpers";

const LINK = "https://drive.google.com/file/d/1RecordingFileId_abc/view?usp=sharing";
let admin: CurrentUser, ops: CurrentUser, teacher: CurrentUser, student: CurrentUser;
let sessionId: string;

beforeAll(async () => {
  const org = await makeOrg("Recording Academy");
  admin = await makeUser(org.id, "SUPER_ADMIN", "Rec Admin");
  ops = await makeUser(org.id, "OPERATIONS", "Rec Ops");
  teacher = await makeUser(org.id, "TEACHER", "Rec Teacher");
  student = await makeUser(org.id, "STUDENT", "Rec Student");
  const c = await createCourse(admin, { type: "ONE_TO_ONE", subjectName: "Maths", teacherId: teacher.id, studentIds: [student.id], timezone: "Asia/Kolkata", meetLink: meetLink() });
  sessionId = (await addOneOffSession(admin, c.id, new Date(Date.now() + 60_000), 60)).id;
});

const openAs = async (u: { id: string }, id: string) => {
  await signInAs(u);
  return openRoute(request(`/admin/recordings/${id}`), { params: Promise.resolve({ id }) });
};

describe("class recordings are for Silora Academy only", () => {
  it("only a Super Admin can add one, and only as a Google Drive file link", async () => {
    await expect(addRecording(ops, sessionId, LINK)).rejects.toThrow(/Super Admin/);
    await expect(addRecording(teacher, sessionId, LINK)).rejects.toThrow(/Super Admin/);
    await expect(addRecording(admin, sessionId, "https://youtube.com/watch?v=x")).rejects.toThrow(/Google Drive link/);
    const r = await addRecording(admin, sessionId, LINK);
    expect(r.url).toBe("https://drive.google.com/file/d/1RecordingFileId_abc/view");
    expect(Math.round((r.expiresAt.getTime() - r.createdAt.getTime()) / 86_400_000)).toBe(RECORDING_KEEP_DAYS);
  });

  it("the class's own teacher and student, and operations staff, can't open it; each attempt is recorded", async () => {
    const r = await db.recording.findFirstOrThrow({ where: { sessionId } });
    for (const u of [teacher, student, ops]) {
      expect(await openRecording(u, r.id)).toBeNull();
      expect((await openAs(u, r.id)).status).toBe(404);
    }
    expect(await db.auditLog.count({ where: { action: "RECORDING_VIEWED", targetId: r.id, result: "DENIED" } })).toBe(6);
  });

  it("a Super Admin is sent to the Drive file, and the viewing is recorded", async () => {
    const r = await db.recording.findFirstOrThrow({ where: { sessionId } });
    const res = await openAs(admin, r.id);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(r.url);
    expect(await db.auditLog.count({ where: { action: "RECORDING_VIEWED", targetId: r.id, result: "SUCCESS", actorId: admin.id } })).toBe(1);
  });

  it(`after ${RECORDING_KEEP_DAYS} days a recording leaves Silora and staff are asked to delete it from Drive`, async () => {
    const r = await db.recording.findFirstOrThrow({ where: { sessionId } });
    const later = new Date(r.expiresAt.getTime() + 1000);
    expect(await expireRecordings(later)).toBe(1);
    expect(await openRecording(admin, r.id)).toBeNull();
    expect(await db.alert.count({ where: { orgId: admin.orgId, type: "RECORDINGS_EXPIRED" } })).toBe(1);

    await confirmDriveDeleted(admin, r.id);
    const gone = await db.recording.findUniqueOrThrow({ where: { id: r.id } });
    expect(gone.driveDeletedAt).toBeInstanceOf(Date);
    expect(gone.url).toBe("");
  });
});
