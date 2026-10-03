// Class monitor loop: calls the tick endpoint every minute.
// Locally: npm run worker (reads .env). In production the worker container runs this with
// MONITOR_URL pointing at the app container and CRON_SECRET from the environment.
import { existsSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  (existsSync(".env") ? readFileSync(".env", "utf8") : "")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const base = process.env.MONITOR_URL || process.env.APP_URL || env.APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET || env.CRON_SECRET;
let lastExtend = 0;

async function tick() {
  const extend = Date.now() - lastExtend > 3_600_000; // extend recurring schedules hourly
  try {
    const res = await fetch(`${base}/api/cron/tick${extend ? "?extend=1" : ""}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.json();
    if (res.ok && extend) lastExtend = Date.now();
    console.log(new Date().toLocaleTimeString(), res.status, JSON.stringify(body));
  } catch (e) {
    console.log(new Date().toLocaleTimeString(), "app not reachable:", e.message);
  }
}

console.log(`Class monitor → ${base} (every 60s)`);
tick();
setInterval(tick, 60_000);
