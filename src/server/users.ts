import "server-only";
import type { Role, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { UserError } from "@/lib/action-result";
import { revokeAllSessions, type CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/authz";

export type UserInput = {
  name: string;
  email: string;
  phone?: string | null;
  timezone?: string | null;
  // teacher
  headline?: string | null;
  // student
  grade?: string | null;
  board?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  notes?: string | null;
};

function assertCanManageRole(actor: CurrentUser, role: Role) {
  const staffRole = role === "SUPER_ADMIN" || role === "OPERATIONS";
  if (staffRole ? !can(actor, "staff.manage") : !can(actor, "people.edit")) {
    throw new UserError("You do not have permission to manage this type of account.");
  }
}

export async function createUser(actor: CurrentUser, role: Role, input: UserInput) {
  assertCanManageRole(actor, role);
  const email = input.email.trim().toLowerCase();
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) throw new UserError(`An account already uses ${email}.`);

  const user = await db.user.create({
    data: {
      orgId: actor.orgId,
      role,
      email,
      name: input.name.trim(),
      phone: input.phone || null,
      timezone: input.timezone || null,
      teacherProfile: role === "TEACHER" ? { create: { headline: input.headline || null, notes: input.notes || null } } : undefined,
      studentProfile:
        role === "STUDENT"
          ? {
              create: {
                grade: input.grade || null,
                board: input.board || null,
                guardianName: input.guardianName || null,
                guardianPhone: input.guardianPhone || null,
                guardianEmail: input.guardianEmail || null,
                notes: input.notes || null,
              },
            }
          : undefined,
    },
  });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "USER_CREATED", targetType: "User", targetId: user.id, metadata: { role } });
  return user;
}

export async function updateUser(actor: CurrentUser, userId: string, input: UserInput) {
  const user = await db.user.findFirst({ where: { id: userId, orgId: actor.orgId } });
  if (!user) throw new UserError("User not found.");
  assertCanManageRole(actor, user.role);

  const email = input.email.trim().toLowerCase();
  const emailChanged = email !== user.email;
  if (emailChanged && (await db.user.findUnique({ where: { email } }))) throw new UserError(`An account already uses ${email}.`);

  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name.trim(),
      email,
      // A new Google account must sign in fresh
      googleSub: emailChanged ? null : undefined,
      phone: input.phone || null,
      timezone: input.timezone || null,
      teacherProfile:
        user.role === "TEACHER"
          ? { upsert: { create: { headline: input.headline || null, notes: input.notes || null }, update: { headline: input.headline || null, notes: input.notes || null } } }
          : undefined,
      studentProfile:
        user.role === "STUDENT"
          ? {
              upsert: {
                create: { grade: input.grade || null, board: input.board || null, guardianName: input.guardianName || null, guardianPhone: input.guardianPhone || null, guardianEmail: input.guardianEmail || null, notes: input.notes || null },
                update: { grade: input.grade || null, board: input.board || null, guardianName: input.guardianName || null, guardianPhone: input.guardianPhone || null, guardianEmail: input.guardianEmail || null, notes: input.notes || null },
              },
            }
          : undefined,
    },
  });
  if (emailChanged) await revokeAllSessions(userId);
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "USER_UPDATED", targetType: "User", targetId: userId, metadata: { emailChanged } });
}

/**
 * Suspend / deactivate / reactivate. Login is revoked immediately; because
 * every access check requires an ACTIVE user, classes and chat stop at once.
 */
export async function setUserStatus(actor: CurrentUser, userId: string, status: UserStatus) {
  if (!can(actor, "people.suspend")) throw new UserError("Only a Super Admin can change account status.");
  if (userId === actor.id) throw new UserError("You cannot change your own account status.");
  const user = await db.user.findFirst({ where: { id: userId, orgId: actor.orgId } });
  if (!user) throw new UserError("User not found.");
  if (user.role === "SUPER_ADMIN" && status !== "ACTIVE") {
    const others = await db.user.count({ where: { orgId: actor.orgId, role: "SUPER_ADMIN", status: "ACTIVE", NOT: { id: userId } } });
    if (!others) throw new UserError("At least one active Super Admin is required.");
  }

  await db.user.update({ where: { id: userId }, data: { status } });
  if (status !== "ACTIVE") await revokeAllSessions(userId);

  const now = new Date();
  if (status === "DEACTIVATED" && user.role === "STUDENT") {
    // One-to-one classes end; group memberships are removed.
    const enrollments = await db.courseStudent.findMany({
      where: { studentId: userId, status: "ACTIVE", course: { status: "ACTIVE" } },
      include: { course: true },
    });
    for (const e of enrollments) {
      if (e.course.type === "ONE_TO_ONE") {
        await db.$transaction([
          db.course.update({ where: { id: e.courseId }, data: { status: "ENDED", endedAt: now, endedReason: "Student deactivated" } }),
          db.schedule.updateMany({ where: { courseId: e.courseId }, data: { active: false } }),
          db.classSession.updateMany({ where: { courseId: e.courseId, status: "SCHEDULED", startsAt: { gt: now } }, data: { status: "CANCELLED", cancelReason: "Student left Silora" } }),
          db.thread.updateMany({ where: { courseId: e.courseId }, data: { status: "READ_ONLY" } }),
        ]);
      }
      await db.courseStudent.update({ where: { id: e.id }, data: { status: "REMOVED", removedAt: now } });
    }
  }

  if (status !== "ACTIVE" && user.role === "TEACHER") {
    // Teacher can no longer sign in, join or message. Ops must reassign their classes.
    const courses = await db.course.findMany({
      where: { teacherId: userId, status: "ACTIVE", sessions: { some: { status: "SCHEDULED", startsAt: { gt: now } } } },
    });
    for (const c of courses) {
      await db.alert.upsert({
        where: { dedupeKey: `teacher_inactive:${c.id}:${userId}` },
        update: { status: "OPEN", resolvedAt: null },
        create: {
          orgId: actor.orgId,
          courseId: c.id,
          type: "TEACHER_INACTIVE",
          severity: "CRITICAL",
          title: "Class needs a new teacher",
          details: `${user.name} was ${status.toLowerCase()} but still has upcoming lessons in "${c.title}". Replace the teacher or cancel the lessons.`,
          dedupeKey: `teacher_inactive:${c.id}:${userId}`,
        },
      });
    }
  }

  await audit({ orgId: actor.orgId, actorId: actor.id, action: `USER_${status}`, targetType: "User", targetId: userId });
}

export async function changeStaffRole(actor: CurrentUser, userId: string, role: "SUPER_ADMIN" | "OPERATIONS") {
  if (!can(actor, "staff.manage")) throw new UserError("Only a Super Admin can change staff roles.");
  const user = await db.user.findFirst({ where: { id: userId, orgId: actor.orgId } });
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "OPERATIONS")) throw new UserError("Staff member not found.");
  if (user.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const others = await db.user.count({ where: { orgId: actor.orgId, role: "SUPER_ADMIN", status: "ACTIVE", NOT: { id: userId } } });
    if (!others) throw new UserError("At least one active Super Admin is required.");
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "STAFF_ROLE_CHANGED", targetType: "User", targetId: userId, metadata: { role } });
}
