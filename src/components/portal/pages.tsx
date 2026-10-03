import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { getCourseAccess, visibleCourseIds } from "@/lib/authz";
import { describeRule } from "@/lib/schedule";
import { addDaysToKey, fmtDate, fmtDateTime, localDateKey, localDayRange, tzLabel } from "@/lib/time";
import { displayIdentity, getThreadAccess, listMessages, markThreadRead, threadsForUser, threadTitle } from "@/server/chat";
import { loadSessions } from "@/server/sessions";
import { openPrivateThreadAction, reportIssueAction, sendMessageAction } from "@/app/portal-actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChatWindow } from "@/components/chat-window";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { LessonCard } from "@/components/portal/lesson-card";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, Notice, PageHeader, StatTile, buttonClass } from "@/components/ui";

type Role = "TEACHER" | "STUDENT";
const baseOf = (role: Role) => (role === "TEACHER" ? "/teacher" : "/student") as "/teacher" | "/student";
const tzOf = (u: CurrentUser) => u.timezone ?? u.org.timezone;
const firstName = (n: string) => n.split(" ")[0];

/* ---------- Today ---------- */

export async function PortalHome({ user }: { user: CurrentUser }) {
  const role = user.role as Role;
  const base = baseOf(role);
  const tz = tzOf(user);
  const now = new Date();
  const todayKey = localDateKey(now, tz);
  const [dayStart, dayEnd] = localDayRange(todayKey, tz);
  const [, weekEnd] = localDayRange(addDaysToKey(todayKey, 7), tz);
  const courseIds = (await visibleCourseIds(user)) ?? [];
  const courseFilter = { courseId: { in: courseIds }, course: { status: "ACTIVE" as const } };

  const [today, upcoming, threads, newFiles] = await Promise.all([
    loadSessions({ ...courseFilter, startsAt: { gte: dayStart, lt: dayEnd } }, user.org),
    loadSessions({ ...courseFilter, startsAt: { gte: dayEnd, lt: weekEnd }, status: "SCHEDULED" }, user.org, { take: 6 }),
    threadsForUser(user),
    db.message.count({
      where: {
        attachmentId: { not: null },
        status: "VISIBLE",
        senderId: { not: user.id },
        createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        thread: { courseId: { in: courseIds } },
      },
    }),
  ]);
  const unread = threads.reduce((n, t) => n + t.unread, 0);
  const remaining = today.filter((s) => s.endsAt > now && s.status !== "CANCELLED");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title={`${greeting}, ${firstName(user.name)}`} subtitle={`${fmtDate(now, tz)} · times shown in ${tzLabel(now, tz)}`} />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Classes left today" value={remaining.length} />
        <StatTile label="Unread messages" value={unread} tone={unread ? "warning" : undefined} href={`${base}/messages`} />
        <StatTile label={role === "STUDENT" ? "New files (7 days)" : "Files received (7 days)"} value={newFiles} href={`${base}/files`} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-navy-900">Today</h2>
        {today.length === 0 ? (
          <Card>
            <EmptyState title="No classes today" body="Enjoy your day! Upcoming classes are listed below." />
          </Card>
        ) : (
          <div className="space-y-3">
            {today.map((s) => (
              <LessonCard key={s.id} s={s} viewer={role} timeZone={tz} joinOpensMinutesBefore={user.org.joinOpensMinutesBefore} base={base} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Coming up this week" />
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled this week" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-semibold text-navy-900">{s.course.subject.name}</p>
                    <p className="text-xs text-slate-500">
                      {role === "TEACHER" ? s.course.students.map((x) => x.student.name).join(", ") : s.course.teacher.name}
                    </p>
                  </div>
                  <span className="text-right text-sm font-semibold text-slate-700">{fmtDateTime(s.startsAt, tz)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Messages"
            action={
              <Link href={`${base}/messages`} className="text-xs font-semibold text-gold-700 hover:underline">
                Open messages
              </Link>
            }
          />
          {threads.length === 0 ? (
            <EmptyState title="No conversations yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link href={`${base}/messages/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <Avatar name={t.title} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">{t.title}</span>
                      <span className="block truncate text-xs text-slate-500">{t.lastMessage?.body || (t.lastMessage ? "📎 File" : "No messages yet")}</span>
                    </span>
                    {t.unread > 0 && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-navy-900">{t.unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------- My classes ---------- */

export async function PortalClasses({ user }: { user: CurrentUser }) {
  const role = user.role as Role;
  const base = baseOf(role);
  const tz = tzOf(user);
  const courses = await db.course.findMany({
    where: role === "TEACHER" ? { orgId: user.orgId, teacherId: user.id } : { orgId: user.orgId, students: { some: { studentId: user.id, status: "ACTIVE" } } },
    include: {
      subject: true,
      teacher: { select: { name: true, teacherProfile: { select: { headline: true } } } },
      students: { where: { status: "ACTIVE" }, include: { student: { select: { name: true } } } },
      schedules: { where: { active: true } },
      sessions: { where: { status: "SCHEDULED", endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <PageHeader title="My classes" subtitle="Each class has its own lesson schedule, Meet room and conversation." />
      {courses.length === 0 ? (
        <Card>
          <EmptyState title="No classes yet" body="Silora Academy will add your classes here." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} href={`${base}/classes/${c.id}`} className="group">
              <Card className="h-full p-5 transition group-hover:ring-gold-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-navy-900">{c.subject.name}</p>
                    <p className="text-sm text-slate-600">
                      {role === "TEACHER"
                        ? `${c.type === "GROUP" ? "Group" : "Student"}: ${c.students.map((s) => s.student.name).join(", ")}`
                        : `Teacher: ${displayIdentity(c.teacher, "TEACHER", c.subject.name)}`}
                    </p>
                  </div>
                  {c.status === "ACTIVE" ? <Badge tone="success">Active</Badge> : <Badge>Ended</Badge>}
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  {c.schedules.map((s) => (
                    <p key={s.id}>{describeRule(s)}</p>
                  ))}
                  {c.sessions[0] && <p className="font-semibold text-navy-800">Next: {fmtDateTime(c.sessions[0].startsAt, tz)}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- One class ---------- */

export async function PortalClassDetail({ user, id }: { user: CurrentUser; id: string }) {
  const role = user.role as Role;
  const base = baseOf(role);
  const tz = tzOf(user);
  const access = await getCourseAccess(user, id);
  if (!access || access.as === "staff") notFound();
  const { course } = access;
  const now = new Date();

  const [upcoming, recent, threads] = await Promise.all([
    loadSessions({ courseId: id, endsAt: { gte: now } }, user.org, { take: 8 }),
    loadSessions({ courseId: id, endsAt: { lt: now } }, user.org, { take: 8, order: "desc" }),
    db.thread.findMany({
      where: { courseId: id, status: { not: "DISABLED" }, OR: role === "TEACHER" ? undefined : [{ kind: "COURSE" }, { studentId: user.id }] },
    }),
  ]);
  const courseThread = threads.find((t) => t.kind === "COURSE");
  const canPrivate = course.type === "GROUP" && user.org.allowPrivateGroupChat && access.active;
  const current = upcoming.find((s) => s.startsAt <= now && s.status !== "CANCELLED");

  return (
    <>
      <PageHeader
        back={{ href: `${base}/classes`, label: "My classes" }}
        title={course.subject.name}
        subtitle={
          role === "TEACHER"
            ? `${course.type === "GROUP" ? `Group · ${course.students.length} students` : `Student: ${course.students[0]?.student.name ?? "—"}`}${course.grade ? ` · ${course.grade}` : ""}`
            : `Teacher: ${displayIdentity(course.teacher, "TEACHER", course.subject.name)}`
        }
        actions={
          courseThread && (
            <ButtonLink href={`${base}/messages/${courseThread.id}`} variant="navy">
              <Icon name="chat" /> {course.type === "GROUP" ? "Class chat" : "Message"}
            </ButtonLink>
          )
        }
      />
      {!access.active && (
        <div className="mb-6">
          <Notice tone="neutral">This class has ended. You can still read its history.</Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-bold text-navy-900">Upcoming lessons</h2>
            {upcoming.length === 0 ? (
              <Card>
                <EmptyState title="No upcoming lessons" />
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((s) => (
                  <LessonCard key={s.id} s={s} viewer={role} timeZone={tz} joinOpensMinutesBefore={user.org.joinOpensMinutesBefore} showDate base={base} />
                ))}
              </div>
            )}
          </section>

          <Card>
            <CardHeader title="Past lessons" />
            {recent.length === 0 ? (
              <EmptyState title="No past lessons yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-semibold text-slate-800">{fmtDateTime(s.startsAt, tz)}</span>
                    <Badge tone={s.status === "COMPLETED" ? "success" : s.status === "CANCELLED" ? "neutral" : "warning"}>
                      {s.status.replaceAll("_", " ").toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {current && (
            <Card>
              <CardHeader title="Problem with this lesson?" subtitle="Silora operations will be alerted right away." />
              <ActionForm action={reportIssueAction.bind(null, current.id)} className="space-y-3 p-5" resetOnSuccess>
                <Input name="note" placeholder="e.g. Meet says the room is full" maxLength={500} required />
                <SubmitButton variant="secondary">Report an issue</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {course.type === "GROUP" && (
            <Card>
              <CardHeader title={role === "TEACHER" ? "Students" : "Class"} />
              <ul className="divide-y divide-slate-100">
                {role === "TEACHER" ? (
                  course.students.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={s.student.name} size="sm" />
                      <span className="flex-1 text-sm font-semibold text-navy-900">{s.student.name}</span>
                      {canPrivate && (
                        <form action={openPrivateThreadAction.bind(null, course.id, s.studentId)}>
                          <button className={buttonClass("ghost", "sm")}>Private message</button>
                        </form>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="space-y-3 px-5 py-4 text-sm text-slate-600">
                    <p>{course.students.length} students in this group.</p>
                    {canPrivate && (
                      <form action={openPrivateThreadAction.bind(null, course.id, user.id)}>
                        <button className={buttonClass("secondary", "sm")}>Message the teacher privately</button>
                      </form>
                    )}
                  </li>
                )}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="How joining works" />
            <ul className="space-y-2 p-5 text-sm text-slate-600">
              <li>• The Join button opens {user.org.joinOpensMinutesBefore} minutes before each lesson.</li>
              <li>• Always join from Silora. It opens this class&apos;s own Google Meet room.</li>
              <li>• Sign in to Google Meet with the same Google account you use for Silora.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------- Messages ---------- */

export async function PortalMessages({ user }: { user: CurrentUser }) {
  const base = baseOf(user.role as Role);
  const tz = tzOf(user);
  const threads = await threadsForUser(user);
  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHeader title="Messages" subtitle="Talk with your classes on Silora. Contact details stay private." />
      <Card>
        {threads.length === 0 ? (
          <EmptyState title="No conversations yet" body="Conversations appear when Silora adds you to a class." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`${base}/messages/${t.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <Avatar name={t.title} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-navy-900">{t.title}</span>
                      {!t.courseActive && <Badge>Ended</Badge>}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {t.lastMessage ? t.lastMessage.body || "📎 File" : "No messages yet"}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {t.lastMessage && <span className="text-[11px] text-slate-400">{fmtDateTime(t.lastMessage.createdAt, tz)}</span>}
                    {t.unread > 0 && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-navy-900">{t.unread}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export async function PortalThread({ user, id }: { user: CurrentUser; id: string }) {
  const base = baseOf(user.role as Role);
  const access = await getThreadAccess(user, id);
  if (!access || access.as === "reviewer") notFound();
  const messages = await listMessages(user, access);
  await markThreadRead(user, id);
  const { course } = access.thread;
  const people =
    access.thread.kind === "PRIVATE"
      ? [course.teacher.name, course.students.find((s) => s.studentId === access.thread.studentId)?.student.name].filter(Boolean)
      : [course.teacher.name, ...course.students.map((s) => s.student.name)];

  return (
    <>
      <PageHeader
        back={{ href: `${base}/messages`, label: "Messages" }}
        title={threadTitle(access.thread, user.role)}
        subtitle={`${course.subject.name} · ${people.join(", ")}`}
        actions={
          <Link href={`${base}/classes/${course.id}`} className={buttonClass("secondary", "sm")}>
            Class details
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <ChatWindow
          threadId={id}
          initialMessages={messages}
          initialCanPost={access.canPost}
          initialReadOnlyReason={access.readOnlyReason}
          send={sendMessageAction.bind(null, id)}
          maxUploadMb={user.org.maxUploadMb}
        />
      </Card>
    </>
  );
}

/* ---------- Files ---------- */

export async function PortalFiles({ user }: { user: CurrentUser }) {
  const base = baseOf(user.role as Role);
  const tz = tzOf(user);
  const courseIds = (await visibleCourseIds(user)) ?? [];
  const messages = await db.message.findMany({
    where: {
      attachmentId: { not: null },
      status: "VISIBLE",
      thread: {
        courseId: { in: courseIds },
        status: { not: "DISABLED" },
        ...(user.role === "STUDENT" ? { OR: [{ kind: "COURSE" as const }, { studentId: user.id }] } : {}),
      },
    },
    include: { attachment: true, sender: { select: { name: true, role: true } }, thread: { include: { course: { include: { subject: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Files" subtitle="Worksheets, images and documents shared in your conversations." />
      <Card>
        {messages.length === 0 ? (
          <EmptyState title="No files yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                  <Icon name="file" />
                </span>
                <span className="min-w-0 flex-1">
                  <a href={`/api/files/${m.attachment!.id}`} target="_blank" rel="noreferrer" className="block truncate font-semibold text-navy-900 hover:underline">
                    {m.attachment!.fileName}
                  </a>
                  <span className="block text-xs text-slate-500">
                    {m.sender.name} · {m.thread.course.subject.name} · {fmtDateTime(m.createdAt, tz)}
                  </span>
                </span>
                <Link href={`${base}/messages/${m.threadId}`} className="hidden text-xs font-semibold text-gold-700 hover:underline sm:block">
                  Open chat
                </Link>
                <a href={`/api/files/${m.attachment!.id}?download=1`} className={buttonClass("secondary", "sm")}>
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
