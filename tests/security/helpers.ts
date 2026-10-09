import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, type CurrentUser } from "@/lib/auth/session";
import { cookieJar } from "./setup";

let n = 0;

export async function makeOrg(name = "Silora Academy") {
  return db.organization.create({ data: { name } });
}

/** A user loaded the same way the app loads the signed-in user. */
export async function makeUser(orgId: string, role: Role, name: string): Promise<CurrentUser> {
  n++;
  const u = await db.user.create({
    data: {
      orgId,
      role,
      name,
      email: `${name.toLowerCase().replace(/\W+/g, ".")}.${n}@example.test`,
      phone: `98765${String(10000 + n).slice(-5)}`,
      teacherProfile: role === "TEACHER" ? { create: { headline: "Teacher" } } : undefined,
      studentProfile: role === "STUDENT" ? { create: { grade: "Grade 10" } } : undefined,
    },
  });
  return reload(u.id);
}

export const reload = (id: string) => db.user.findUniqueOrThrow({ where: { id }, include: { org: true } });

/** A fresh valid Meet link (each class needs its own; codes are letters only, like abc-defg-hij). */
export const meetLink = () => {
  const letters = (len: number) => Array.from(randomBytes(len), (b) => String.fromCharCode(97 + (b % 26))).join("");
  return `https://meet.google.com/${letters(3)}-${letters(4)}-${letters(3)}`;
};

/** Signs the next "request" in as this user, like the session cookie would. */
export async function signInAs(user: { id: string } | null) {
  cookieJar.clear();
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({
    data: { id: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  cookieJar.set(SESSION_COOKIE, token);
}

export const request = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));

export const png = () => {
  const b = Buffer.alloc(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([b], "homework.png", { type: "image/png" });
};
