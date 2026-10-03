import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { recordMonitorTick } from "@/lib/heartbeat";
import { runMonitorTick } from "@/server/monitor";

// Called every minute by the worker (npm run worker locally, the worker container in production).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const extendSchedules = req.nextUrl.searchParams.get("extend") === "1";
  const stats = await runMonitorTick(new Date(), { extendSchedules });
  recordMonitorTick();
  return NextResponse.json({ ok: true, ...stats });
}
