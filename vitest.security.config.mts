import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Security tests: run the real access rules against a throwaway Postgres database.
 *   npm run test:security   (needs the local database running: npm run db)
 * TEST_DATABASE_URL picks the database (default: silora_test on the local dev server).
 * It is dropped and recreated on every run, so never point it at real data.
 */
const testDb = (process.env.TEST_DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/silora_test"); // also read by global-setup.ts

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/security/**/*.test.ts"],
    globalSetup: ["tests/security/global-setup.ts"],
    setupFiles: ["tests/security/setup.ts"],
    env: { DATABASE_URL: testDb, TEST_DATABASE_URL: testDb, STORAGE_DRIVER: "local", STORAGE_DIR: "./.test-storage", EMAIL_DRIVER: "log" },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
