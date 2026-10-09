import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { POLICY_VERSION } from "@/lib/legal";
import { acceptPolicyAction } from "@/app/portal-actions";
import { setGuardianConsent } from "@/server/users";
import { makeOrg, makeUser, reload, signInAs } from "./helpers";

let ops: CurrentUser, teacher: CurrentUser, student: CurrentUser, otherOrgStaff: CurrentUser;

beforeAll(async () => {
  const org = await makeOrg("Consent Academy");
  ops = await makeUser(org.id, "OPERATIONS", "Consent Ops");
  teacher = await makeUser(org.id, "TEACHER", "Consent Teacher");
  student = await makeUser(org.id, "STUDENT", "Consent Student");
  otherOrgStaff = await makeUser((await makeOrg("Elsewhere")).id, "SUPER_ADMIN", "Other Admin");
});

describe("privacy policy agreement", () => {
  it("records which version the signed-in user agreed to, and when", async () => {
    expect((await reload(student.id)).policyVersion).toBeNull();
    await signInAs(student);
    await acceptPolicyAction();
    const u = await reload(student.id);
    expect(u.policyVersion).toBe(POLICY_VERSION);
    expect(u.policyAcceptedAt).toBeInstanceOf(Date);
    expect(await db.auditLog.count({ where: { action: "POLICY_ACCEPTED", actorId: student.id } })).toBe(1);
  });
});

describe("parent consent", () => {
  it("operations staff can record and remove it, with a record of who did it", async () => {
    const at = new Date("2026-10-01T06:30:00Z");
    await setGuardianConsent(ops, student.id, { method: "Signed form", at });
    let p = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
    expect(p).toMatchObject({ guardianConsentAt: at, guardianConsentMethod: "Signed form", guardianConsentById: ops.id });

    await setGuardianConsent(ops, student.id, null);
    p = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
    expect(p.guardianConsentAt).toBeNull();
    expect(await db.auditLog.count({ where: { targetId: student.id, action: { startsWith: "GUARDIAN_CONSENT" } } })).toBe(2);
  });

  it("teachers and other academies can't change it, and dates can't be in the future", async () => {
    const at = new Date();
    await expect(setGuardianConsent(teacher, student.id, { method: "Email reply", at })).rejects.toThrow(/permission/);
    await expect(setGuardianConsent(otherOrgStaff, student.id, { method: "Email reply", at })).rejects.toThrow(/not found/);
    await expect(setGuardianConsent(ops, student.id, { method: "Email reply", at: new Date(Date.now() + 3 * 86_400_000) })).rejects.toThrow(/future/);
    await expect(setGuardianConsent(ops, teacher.id, { method: "Email reply", at })).rejects.toThrow(/not found/);
  });
});
