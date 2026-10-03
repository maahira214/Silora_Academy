import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "silora_session";
const SESSION_DAYS = 30;
const RENEW_WITHIN_DAYS = 15;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  await db.authSession.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      ip: clientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user, or null. Suspended/deactivated users are treated as signed out. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const session = await db.authSession.findUnique({
    where: { id },
    include: { user: { include: { org: true } } },
  });
  if (!session) return null;

  if (session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    await db.authSession.deleteMany({ where: { id } });
    return null;
  }

  if (session.expiresAt.getTime() - Date.now() < RENEW_WITHIN_DAYS * 86_400_000) {
    await db.authSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
    });
  }
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revoke every login of a user, e.g. when they are suspended or deactivated. */
export async function revokeAllSessions(userId: string) {
  await db.authSession.deleteMany({ where: { userId } });
}

export function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}
