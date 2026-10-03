import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseBackupTime } = await import("@/server/backup-status");

describe("parseBackupTime", () => {
  it("reads the time from a backup key", () => {
    expect(parseBackupTime("backups/silora-2026-10-03T2130Z.dump")?.toISOString()).toBe("2026-10-03T21:30:00.000Z");
  });
  it("ignores other files", () => {
    expect(parseBackupTime("backups/notes.txt")).toBeNull();
  });
});
