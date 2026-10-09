import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/** Fresh, empty test database with all migrations applied. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]*test[a-z0-9_]*$/.test(name)) throw new Error(`Refusing to reset "${name}": the test database name must contain "test".`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const db = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await db.$disconnect();
  }
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" });

  return () => rmSync(".test-storage", { recursive: true, force: true });
}
