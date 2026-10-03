import "server-only";
import { listObjects } from "@/server/storage";

// Nightly database backups land in R2 as backups/silora-YYYY-MM-DDTHHMMZ.dump (scripts/backup.mjs).
// The health check reports a problem if the newest one is too old, so a broken backup job
// raises an uptime alert instead of going unnoticed.
export const BACKUP_MAX_AGE_MS = 26 * 3_600_000;
const CACHE_MS = 10 * 60_000;

export function parseBackupTime(key: string) {
  const m = key.match(/silora-(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})Z\.dump$/);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00Z`) : null;
}

let cached: { at: number; value: { ok: boolean; latest: string | null } } | undefined;

export async function backupHealth(now = Date.now()) {
  if (process.env.STORAGE_DRIVER !== "r2") return { ok: true, latest: null, checked: false };
  if (!cached || now - cached.at > CACHE_MS) {
    try {
      const times = (await listObjects("backups/")).map(parseBackupTime).filter((d): d is Date => d !== null);
      const latest = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
      cached = { at: now, value: { ok: !!latest && now - latest.getTime() < BACKUP_MAX_AGE_MS, latest: latest?.toISOString() ?? null } };
    } catch {
      cached = { at: now, value: { ok: false, latest: null } };
    }
  }
  return { ...cached.value, checked: true };
}
