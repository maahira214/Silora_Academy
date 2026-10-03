// Database backups to Cloudflare R2.
//
//   node scripts/backup.mjs schedule            run forever: back up daily at 21:30 UTC (3 AM India time)
//   node scripts/backup.mjs backup              dump the database and upload it to R2 now
//   node scripts/backup.mjs list                list backups in R2, newest first
//   node scripts/backup.mjs restore [key]       download a backup (default: newest) and restore it
//
// Runs inside the "backup" container (deploy/backup/Dockerfile), which has pg_dump/pg_restore
// matching the Postgres server version. Needs DATABASE_URL and the R2_* settings.
// Old backups are removed by an R2 lifecycle rule on the "backups/" prefix (see deploy/README.md).
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const PREFIX = "backups/";

export function r2(env = process.env) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Backups need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
  }
  const client = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const bucketUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  const check = async (res, what) => {
    if (!res.ok) throw new Error(`R2 ${what} failed (${res.status}): ${await res.text()}`);
    return res;
  };
  return {
    put: async (key, data) =>
      check(await client.fetch(`${bucketUrl}/${key}`, { method: "PUT", body: data, headers: { "Content-Type": "application/octet-stream" } }), "upload"),
    get: async (key) => Buffer.from(await (await check(await client.fetch(`${bucketUrl}/${key}`), "download")).arrayBuffer()),
    async list(prefix) {
      const keys = [];
      let token;
      do {
        const q = new URLSearchParams({ "list-type": "2", prefix, ...(token ? { "continuation-token": token } : {}) });
        const xml = await (await check(await client.fetch(`${bucketUrl}?${q}`), "list")).text();
        keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]));
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1] : undefined;
      } while (token);
      return keys;
    },
  };
}

/** backups/silora-2026-10-03T2130Z.dump — sorts by time as plain text. */
export const backupKey = (at = new Date()) => `${PREFIX}silora-${at.toISOString().slice(0, 16).replace(/:/g, "")}Z.dump`;

export const newestFirst = (keys) => keys.filter((k) => k.startsWith(PREFIX) && k.endsWith(".dump")).sort().reverse();

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))));
  });
}

// pg_dump/pg_restore take the connection string as --dbname; Prisma's ?schema= parameter isn't valid for libpq.
const libpqUrl = (url) => {
  const u = new URL(url);
  u.searchParams.delete("schema");
  return u.toString();
};

export async function backup({ store = r2(), dbUrl = process.env.DATABASE_URL, exec = run, now = new Date() } = {}) {
  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  const file = join(tmpdir(), `silora-backup-${process.pid}.dump`);
  try {
    // Custom format: compressed, and pg_restore can restore it table by table.
    await exec("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`, `--dbname=${libpqUrl(dbUrl)}`]);
    const data = await readFile(file);
    if (data.length === 0) throw new Error("pg_dump produced an empty file");
    const key = backupKey(now);
    await store.put(key, data);
    console.log(`${new Date().toISOString()} backup uploaded: ${key} (${(data.length / 1024).toFixed(0)} KB)`);
    return key;
  } finally {
    await rm(file, { force: true });
  }
}

export async function restore(key, { store = r2(), dbUrl = process.env.DATABASE_URL, exec = run } = {}) {
  if (!dbUrl) throw new Error("DATABASE_URL is not set");
  const chosen = key ?? newestFirst(await store.list(PREFIX))[0];
  if (!chosen) throw new Error("No backups found in R2");
  const file = join(tmpdir(), `silora-restore-${process.pid}.dump`);
  try {
    await writeFile(file, await store.get(chosen));
    console.log(`Restoring ${chosen} ...`);
    // --clean --if-exists replaces existing tables, so restoring onto a live database or an empty one both work.
    await exec("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", `--dbname=${libpqUrl(dbUrl)}`, file]);
    console.log(`Restored ${chosen}`);
    return chosen;
  } finally {
    await rm(file, { force: true });
  }
}

/** Next 21:30 UTC (3:00 AM India time, outside class hours) after `now`. */
export function nextRunAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21, 30));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

const backupTime = (key) => {
  const m = key.match(/silora-(d{4}-d{2}-d{2})T(d{2})(d{2})Z.dump$/);
  return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00Z`) : null;
};

async function schedule() {
  const store = r2();
  const tryBackup = () => backup({ store }).catch((e) => console.error(`${new Date().toISOString()} backup FAILED: ${e.message}`));
  // On a fresh or restarted server, take a backup straight away if the newest one is over a day old.
  const newest = newestFirst(await store.list(PREFIX).catch(() => []))[0];
  const newestAt = newest && backupTime(newest);
  if (!newestAt || Date.now() - newestAt.getTime() > 24 * 3_600_000) await tryBackup();
  for (;;) {
    const at = nextRunAt();
    console.log(`Next backup at ${at.toISOString()}`);
    await new Promise((r) => setTimeout(r, at.getTime() - Date.now()));
    await tryBackup();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("backup.mjs")) {
  const [cmd, arg] = process.argv.slice(2);
  const actions = {
    schedule,
    backup: () => backup(),
    restore: () => restore(arg),
    list: async () => newestFirst(await r2().list(PREFIX)).forEach((k) => console.log(k)),
  };
  if (!actions[cmd]) {
    console.error("Usage: node scripts/backup.mjs schedule | backup | list | restore [key]");
    process.exit(2);
  }
  actions[cmd]().catch((e) => {
    console.error(`${new Date().toISOString()} ${cmd} FAILED: ${e.message}`);
    process.exit(1);
  });
}
