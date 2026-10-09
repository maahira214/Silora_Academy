// Local development PostgreSQL (no Docker or system install needed).
// Usage: npm run db  — keep it running in its own terminal.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(process.cwd(), ".pgdata");
const firstRun = !existsSync(resolve(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
  // UTF-8 like production. Without this, Windows creates the database in its own
  // encoding and names or messages in Hindi, emoji, etc. can't be saved.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) {
  const client = pg.getPgClient();
  await client.connect();
  await client.query("CREATE DATABASE silora ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
  await client.end();
}

console.log("PostgreSQL running on localhost:5433 (database: silora). Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
