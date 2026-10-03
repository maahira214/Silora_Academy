import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitorHealth } from "@/lib/heartbeat";
import { backupHealth } from "@/server/backup-status";

// Uptime check target (UptimeRobot): 200 when the app, database, class monitor and nightly
// backups are working, 503 otherwise. Shows no user data, so it needs no sign-in.
export const dynamic = "force-dynamic";

export async function GET() {
  let database = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = false;
  }
  const monitor = monitorHealth();
  const backups = await backupHealth();
  const ok = database && monitor.ok && backups.ok;
  return NextResponse.json(
    { ok, database, monitor, backups },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
