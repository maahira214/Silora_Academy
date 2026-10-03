"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { devLoginEnabled } from "@/lib/auth/google";
import { homeFor } from "@/lib/authz";

export async function devLogin(formData: FormData) {
  if (!devLoginEnabled()) throw new Error("Dev login is disabled.");
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) } });
  if (!user || user.status !== "ACTIVE") redirect("/login?error=account_inactive");
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ orgId: user.orgId, actorId: user.id, action: "LOGIN", targetType: "User", targetId: user.id, metadata: { method: "dev" } });
  redirect(homeFor(user.role));
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await audit({ orgId: user.orgId, actorId: user.id, action: "LOGOUT", targetType: "User", targetId: user.id });
  await destroySession();
  redirect("/login");
}
