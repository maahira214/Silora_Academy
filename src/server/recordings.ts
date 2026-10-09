import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { UserError } from "@/lib/action-result";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/authz";
import { RECORDING_KEEP_DAYS } from "@/lib/legal";
import { parseDriveLink } from "@/lib/recording-link";

/**
 * Class video recordings. Only Super Admins ("recordings.view") can add, open or remove them;
 * teachers and students never see them. Each recording is removed from Silora after
 * RECORDING_KEEP_DAYS, and staff are asked to delete the file from Google Drive too.
 * Today links are added by hand; once Silora's paid Google Meet plan is connected they can be
 * attached automatically (source GOOGLE_API).
 */

function assertCan(actor: CurrentUser) {
  if (!can(actor, "recordings.view")) throw new UserError("Only a Super Admin can manage class recordings.");
}

export async function addRecording(actor: CurrentUser, sessionId: string, link: string, now = new Date()) {
  assertCan(actor);
  const url = parseDriveLink(link);
  if (!url) throw new UserError("Paste the Google Drive link of the recording (https://drive.google.com/file/d/…).");
  const session = await db.classSession.findFirst({ where: { id: sessionId, orgId: actor.orgId } });
  if (!session) throw new UserError("Lesson not found.");
  const r = await db.recording.create({
    data: { orgId: actor.orgId, sessionId, url, addedById: actor.id, expiresAt: new Date(now.getTime() + RECORDING_KEEP_DAYS * 86_400_000) },
  });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "RECORDING_ADDED", targetType: "ClassSession", targetId: sessionId, metadata: { recordingId: r.id } });
  return r;
}

/** The Drive link to open, after checking access and recording who watched. */
export async function openRecording(actor: CurrentUser, recordingId: string) {
  if (!can(actor, "recordings.view")) {
    await audit({ orgId: actor.orgId, actorId: actor.id, action: "RECORDING_VIEWED", targetType: "Recording", targetId: recordingId, result: "DENIED" });
    return null;
  }
  const r = await db.recording.findFirst({ where: { id: recordingId, orgId: actor.orgId, removedAt: null } });
  if (!r) return null;
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "RECORDING_VIEWED", targetType: "Recording", targetId: r.id, metadata: { sessionId: r.sessionId } });
  return r.url;
}

export async function removeRecording(actor: CurrentUser, recordingId: string) {
  assertCan(actor);
  const r = await db.recording.findFirst({ where: { id: recordingId, orgId: actor.orgId, removedAt: null } });
  if (!r) throw new UserError("Recording not found.");
  await db.recording.update({ where: { id: r.id }, data: { removedAt: new Date(), removedNote: `Removed by ${actor.name}` } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "RECORDING_REMOVED", targetType: "Recording", targetId: r.id });
}

/** Staff confirm the file was deleted from Google Drive too; the link is then forgotten. */
export async function confirmDriveDeleted(actor: CurrentUser, recordingId: string) {
  assertCan(actor);
  const r = await db.recording.findFirst({ where: { id: recordingId, orgId: actor.orgId, removedAt: { not: null }, driveDeletedAt: null } });
  if (!r) throw new UserError("Recording not found.");
  await db.recording.update({ where: { id: r.id }, data: { driveDeletedAt: new Date(), url: "" } });
  await audit({ orgId: actor.orgId, actorId: actor.id, action: "RECORDING_DRIVE_DELETED", targetType: "Recording", targetId: r.id });
}

/** Class monitor: take expired recordings out of Silora and remind staff to delete them from Drive. */
export async function expireRecordings(now = new Date()) {
  const expired = await db.recording.findMany({ where: { removedAt: null, expiresAt: { lte: now } }, select: { id: true, orgId: true } });
  if (!expired.length) return 0;
  await db.recording.updateMany({ where: { id: { in: expired.map((r) => r.id) } }, data: { removedAt: now, removedNote: `Expired after ${RECORDING_KEEP_DAYS} days` } });
  for (const orgId of new Set(expired.map((r) => r.orgId))) {
    const count = expired.filter((r) => r.orgId === orgId).length;
    await db.alert.upsert({
      where: { dedupeKey: `recordings_expired:${orgId}:${now.toISOString().slice(0, 10)}` },
      update: { details: `More recordings reached ${RECORDING_KEEP_DAYS} days today. Open More → Recordings to delete them from Google Drive.` },
      create: {
        orgId,
        type: "RECORDINGS_EXPIRED",
        severity: "INFO",
        title: `${count} class recording${count === 1 ? "" : "s"} to delete from Google Drive`,
        details: `They reached ${RECORDING_KEEP_DAYS} days and were removed from Silora. Open More → Recordings to delete them from Google Drive.`,
        dedupeKey: `recordings_expired:${orgId}:${now.toISOString().slice(0, 10)}`,
      },
    });
  }
  return expired.length;
}
