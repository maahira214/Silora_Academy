import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

/**
 * Server-side authorization. Every page, server action and route handler calls
 * one of these — hiding a button in the UI is never the access control.
 */

const PERMISSIONS = {
  "classes.manage": ["SUPER_ADMIN", "OPERATIONS"],
  "sessions.manage": ["SUPER_ADMIN", "OPERATIONS"],
  "alerts.manage": ["SUPER_ADMIN", "OPERATIONS"],
  "people.view": ["SUPER_ADMIN", "OPERATIONS"],
  "people.edit": ["SUPER_ADMIN", "OPERATIONS"],
  "people.suspend": ["SUPER_ADMIN"],
  "staff.manage": ["SUPER_ADMIN"],
  "settings.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN"],
  "chat.review": ["SUPER_ADMIN"],
  // Class video recordings are for Silora Academy only: never teachers or students
  "recordings.view": ["SUPER_ADMIN"],
  "chat.control": ["SUPER_ADMIN", "OPERATIONS"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const isStaffRole = (role: Role) => role === "SUPER_ADMIN" || role === "OPERATIONS";

export function can(user: { role: Role }, permission: Permission) {
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

export const homeFor = (role: Role) =>
  isStaffRole(role) ? "/admin" : role === "TEACHER" ? "/teacher" : "/student";

/** For pages: redirect to /login when signed out, or to the user's own area when the role doesn't match. */
export async function requirePageUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function requirePagePermission(permission: Permission) {
  const user = await requirePageUser();
  if (!can(user, permission)) redirect(homeFor(user.role));
  return user;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in again.");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user, permission)) throw new ForbiddenError();
  return user;
}

export type CourseRole = "teacher" | "student" | "staff";

/**
 * How (if at all) a user is related to a course. Teachers/students only get
 * access through an assignment Silora created; staff get org-wide access.
 */
export async function getCourseAccess(user: CurrentUser, courseId: string) {
  const course = await db.course.findFirst({
    where: { id: courseId, orgId: user.orgId },
    include: {
      subject: true,
      teacher: { select: { id: true, name: true, status: true, teacherProfile: { select: { headline: true } } } },
      students: {
        where: { status: "ACTIVE" },
        include: { student: { select: { id: true, name: true, status: true } } },
      },
    },
  });
  if (!course) return null;

  let as: CourseRole | null = null;
  if (isStaffRole(user.role)) as = "staff";
  else if (user.role === "TEACHER" && course.teacherId === user.id) as = "teacher";
  else if (user.role === "STUDENT" && course.students.some((s) => s.studentId === user.id)) as = "student";

  if (!as) return null;
  return { course, as, active: course.status === "ACTIVE" };
}

/** Ids of courses a teacher/student may see (staff: null = everything in the org). */
export async function visibleCourseIds(user: CurrentUser): Promise<string[] | null> {
  if (isStaffRole(user.role)) return null;
  if (user.role === "TEACHER") {
    const rows = await db.course.findMany({ where: { teacherId: user.id }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  const rows = await db.courseStudent.findMany({
    where: { studentId: user.id, status: "ACTIVE" },
    select: { courseId: true },
  });
  return rows.map((r) => r.courseId);
}
