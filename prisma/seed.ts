/* Development seed data. Run: npm run db:seed (wipes and recreates demo data). */
import { PrismaClient, type ClassType } from "@prisma/client";
import { expandRecurrence, GENERATION_HORIZON_DAYS } from "../src/lib/schedule";
import { dateOnly, localDateKey } from "../src/lib/time";

const db = new PrismaClient();
const TZ = "Asia/Kolkata";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");

  // Clean slate (order matters for FKs)
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.alert.deleteMany(),
    db.notification.deleteMany(),
    db.threadRead.deleteMany(),
    db.message.deleteMany(),
    db.attachment.deleteMany(),
    db.thread.deleteMany(),
    db.attendance.deleteMany(),
    db.classSession.deleteMany(),
    db.schedule.deleteMany(),
    db.courseStudent.deleteMany(),
    db.course.deleteMany(),
    db.subject.deleteMany(),
    db.authSession.deleteMany(),
    db.teacherProfile.deleteMany(),
    db.studentProfile.deleteMany(),
    db.user.deleteMany(),
    db.organization.deleteMany(),
  ]);

  const org = await db.organization.create({ data: { name: "Silora Academy", timezone: TZ } });
  const user = (role: "SUPER_ADMIN" | "OPERATIONS" | "TEACHER" | "STUDENT", name: string, email: string, extra: object = {}) =>
    db.user.create({ data: { orgId: org.id, role, name, email, ...extra } });

  await user("SUPER_ADMIN", "Silora Admin", "admin@example.com");
  await user("OPERATIONS", "Ops Desk", "ops@example.com");

  const teacher = (name: string, email: string, headline: string, phone: string) =>
    user("TEACHER", name, email, { phone, teacherProfile: { create: { headline } } });
  const rahul = await teacher("Rahul Verma", "rahul.teacher@example.com", "Mathematics Teacher", "+91 90000 00001");
  const priya = await teacher("Priya Nair", "priya.teacher@example.com", "Physics Teacher", "+91 90000 00002");
  const amit = await teacher("Amit Shah", "amit.teacher@example.com", "Chemistry Teacher", "+91 90000 00003");
  const kiran = await teacher("Kiran Rao", "kiran.teacher@example.com", "Computer Science Teacher", "+91 90000 00004");

  const student = (name: string, email: string, grade: string, board: string, tz?: string) =>
    user("STUDENT", name, email, {
      timezone: tz,
      phone: "+91 80000 00000",
      studentProfile: { create: { grade, board, guardianName: `Parent of ${name.split(" ")[0]}`, guardianPhone: "+91 80000 00001" } },
    });
  const aisha = await student("Aisha Khan", "aisha.student@example.com", "Grade 10", "CBSE");
  const aarav = await student("Aarav Mehta", "aarav.student@example.com", "Grade 10", "ICSE");
  const sarah = await student("Sarah Thomas", "sarah.student@example.com", "Grade 9", "IGCSE", "Asia/Dubai");
  const rohan = await student("Rohan Das", "rohan.student@example.com", "Grade 11", "CBSE");
  const riya = await student("Riya Sen", "riya.student@example.com", "Grade 10", "CBSE");
  const kabir = await student("Kabir Malhotra", "kabir.student@example.com", "Grade 10", "CBSE");
  const meera = await student("Meera Iyer", "meera.student@example.com", "Grade 10", "CBSE");

  const now = new Date();
  const today = localDateKey(now, TZ);
  let meetSeq = 0;
  const fakeMeet = () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const n = meetSeq++;
    const pick = (len: number, salt: number) => Array.from({ length: len }, (_, i) => letters[(n * 7 + i * 3 + salt) % 26]).join("");
    const code = `${pick(3, 1)}-${pick(4, 5)}-${pick(3, 11)}`;
    return { meetCode: code, meetUrl: `https://meet.google.com/${code}` };
  };

  async function course(opts: {
    title: string;
    type: ClassType;
    subject: string;
    teacherId: string;
    studentIds: string[];
    grade?: string;
    board?: string;
    weekdays: number[];
    time: string;
    duration: number;
  }) {
    const subject = await db.subject.upsert({
      where: { orgId_name: { orgId: org.id, name: opts.subject } },
      update: {},
      create: { orgId: org.id, name: opts.subject },
    });
    const c = await db.course.create({
      data: {
        orgId: org.id,
        title: opts.title,
        type: opts.type,
        subjectId: subject.id,
        teacherId: opts.teacherId,
        grade: opts.grade,
        board: opts.board,
        timezone: TZ,
        ...fakeMeet(),
        students: { create: opts.studentIds.map((studentId) => ({ studentId })) },
        threads: { create: { kind: "COURSE" } },
        schedules: {
          create: { weekdays: opts.weekdays, startTime: opts.time, durationMin: opts.duration, timezone: TZ, validFrom: dateOnly(today) },
        },
      },
      include: { schedules: true },
    });
    const sc = c.schedules[0];
    const occ = expandRecurrence(sc, now, new Date(now.getTime() + GENERATION_HORIZON_DAYS * 86_400_000));
    await db.classSession.createMany({
      data: occ.map((o) => ({ orgId: org.id, courseId: c.id, scheduleId: sc.id, slotAt: o.startsAt, startsAt: o.startsAt, endsAt: o.endsAt })),
    });
    return c;
  }

  // Aisha has a separate relationship (and Meet link) per subject
  const aishaMaths = await course({ title: "Mathematics — Aisha Khan", type: "ONE_TO_ONE", subject: "Mathematics", teacherId: rahul.id, studentIds: [aisha.id], grade: "Grade 10", board: "CBSE", weekdays: [1, 3, 5], time: "18:00", duration: 60 });
  const aishaPython = await course({ title: "Python — Aisha Khan", type: "ONE_TO_ONE", subject: "Python", teacherId: kiran.id, studentIds: [aisha.id], grade: "Grade 10", weekdays: [2, 4], time: "17:00", duration: 60 });
  await course({ title: "Cybersecurity — Aisha Khan", type: "ONE_TO_ONE", subject: "Cybersecurity", teacherId: kiran.id, studentIds: [aisha.id], weekdays: [6], time: "11:00", duration: 90 });
  const aaravMaths = await course({ title: "Mathematics — Aarav Mehta", type: "ONE_TO_ONE", subject: "Mathematics", teacherId: rahul.id, studentIds: [aarav.id], grade: "Grade 10", board: "ICSE", weekdays: [2, 4, 6], time: "19:30", duration: 60 });
  await course({ title: "Physics — Sarah Thomas", type: "ONE_TO_ONE", subject: "Physics", teacherId: priya.id, studentIds: [sarah.id], grade: "Grade 9", board: "IGCSE", weekdays: [1, 4], time: "18:00", duration: 60 });
  const rohanChem = await course({ title: "Chemistry — Rohan Das", type: "ONE_TO_ONE", subject: "Chemistry", teacherId: amit.id, studentIds: [rohan.id], grade: "Grade 11", board: "CBSE", weekdays: [3, 5], time: "16:00", duration: 60 });
  const group = await course({ title: "Mathematics — Grade 10 group", type: "GROUP", subject: "Mathematics", teacherId: rahul.id, studentIds: [riya.id, kabir.id, meera.id], grade: "Grade 10", board: "CBSE", weekdays: [0], time: "10:00", duration: 90 });

  // Lessons happening around "now" so the live dashboard has something to show
  const at = (minFromNow: number) => new Date(Math.round((now.getTime() + minFromNow * 60_000) / 60_000) * 60_000);
  const live = await db.classSession.create({ data: { orgId: org.id, courseId: aishaMaths.id, startsAt: at(-20), endsAt: at(40) } });
  await db.attendance.createMany({
    data: [
      { sessionId: live.id, userId: rahul.id, firstJoinAt: at(-22), lastJoinAt: at(-22), joinCount: 1 },
      { sessionId: live.id, userId: aisha.id, firstJoinAt: at(-19), lastJoinAt: at(-19), joinCount: 1 },
    ],
  });
  await db.classSession.create({ data: { orgId: org.id, courseId: rohanChem.id, startsAt: at(-8), endsAt: at(52) } }); // teacher missing
  const studentLate = await db.classSession.create({ data: { orgId: org.id, courseId: aaravMaths.id, startsAt: at(-12), endsAt: at(48) } });
  await db.attendance.create({ data: { sessionId: studentLate.id, userId: rahul.id, firstJoinAt: at(-13), lastJoinAt: at(-13), joinCount: 1 } });
  await db.classSession.create({ data: { orgId: org.id, courseId: aishaPython.id, startsAt: at(5), endsAt: at(65) } }); // open to join
  await db.classSession.create({ data: { orgId: org.id, courseId: group.id, startsAt: at(45), endsAt: at(135) } });
  const past = await db.classSession.create({ data: { orgId: org.id, courseId: aishaMaths.id, startsAt: at(-60 * 24 * 2), endsAt: at(-60 * 24 * 2 + 60), status: "COMPLETED", completedAt: at(-60 * 24 * 2 + 60) } });
  await db.attendance.createMany({
    data: [
      { sessionId: past.id, userId: rahul.id, firstJoinAt: at(-60 * 24 * 2 - 2), joinCount: 1 },
      { sessionId: past.id, userId: aisha.id, firstJoinAt: at(-60 * 24 * 2 + 2), joinCount: 1 },
    ],
  });

  // A short conversation
  const thread = await db.thread.findFirstOrThrow({ where: { courseId: aishaMaths.id, kind: "COURSE" } });
  const msgs: [string, string, number][] = [
    [rahul.id, "Please complete questions 1–10 from the worksheet.", -30],
    [aisha.id, "Sir, I have a doubt in question 5.", -25],
    [rahul.id, "Send me a picture of your working.", -24],
  ];
  for (const [senderId, body, min] of msgs) {
    await db.message.create({ data: { threadId: thread.id, senderId, body, createdAt: at(min) } });
  }

  console.log("Seeded Silora Academy demo data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
