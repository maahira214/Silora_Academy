import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runMonitorTick } from "@/server/monitor";

// Called every minute by the worker (dev) or Cloud Scheduler (production).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const extendSchedules = req.nextUrl.searchParams.get("extend") === "1";
  const stats = await runMonitorTick(new Date(), { extendSchedules });
  return NextResponse.json({ ok: true, ...stats });
}
