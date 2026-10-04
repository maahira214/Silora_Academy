import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { backup, backupKey, backupTime, localStore, newestFirst, nextRunAt, pgBinDir, restore } from "../scripts/backup.mjs";

const fakeStore = (files: Record<string, Buffer> = {}) => ({
  files,
  put: vi.fn(async (key: string, data: Buffer) => void (files[key] = data)),
  get: vi.fn(async (key: string) => files[key]),
  list: vi.fn(async () => Object.keys(files)),
});
const fileArg = (args: string[]) => args.find((a) => a.startsWith("--file="))!.slice("--file=".length);

describe("database backups", () => {
  it("names backups so they sort by time", () => {
    expect(backupKey(new Date("2026-10-03T21:30:45Z"))).toBe("backups/silora-2026-10-03T2130Z.dump");
    expect(newestFirst(["backups/silora-2026-10-02T2130Z.dump", "uploads/x.pdf", "backups/silora-2026-10-03T2130Z.dump"])).toEqual([
      "backups/silora-2026-10-03T2130Z.dump",
      "backups/silora-2026-10-02T2130Z.dump",
    ]);
  });

  it("dumps the database and uploads the file", async () => {
    const store = fakeStore();
    const exec = vi.fn(async (_cmd: string, args: string[]) => writeFile(fileArg(args), "PGDMP-data"));
    const key = await backup({ store, exec, dbUrl: "postgresql://u:p@db:5432/silora?schema=public", now: new Date("2026-10-03T21:30:00Z") });

    expect(key).toBe("backups/silora-2026-10-03T2130Z.dump");
    expect(store.files[key].toString()).toBe("PGDMP-data");
    const [cmd, args] = exec.mock.calls[0];
    expect(cmd).toBe("pg_dump");
    expect(args).toContain("--format=custom");
    expect(args).toContain("--dbname=postgresql://u:p@db:5432/silora"); // Prisma's ?schema= stripped for libpq
  });

  it("fails loudly on an empty dump instead of uploading it", async () => {
    const store = fakeStore();
    const exec = vi.fn(async (_cmd: string, args: string[]) => writeFile(fileArg(args), ""));
    await expect(backup({ store, exec, dbUrl: "postgresql://x/y" })).rejects.toThrow(/empty/);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("restores the newest backup by default", async () => {
    const store = fakeStore({
      "backups/silora-2026-10-01T2130Z.dump": Buffer.from("old"),
      "backups/silora-2026-10-02T2130Z.dump": Buffer.from("new"),
    });
    let restored = "";
    const exec = vi.fn(async (_cmd: string, args: string[]) => void (restored = await readFile(args.at(-1)!, "utf8")));
    const key = await restore(undefined, { store, exec, dbUrl: "postgresql://x/y" });

    expect(key).toBe("backups/silora-2026-10-02T2130Z.dump");
    expect(restored).toBe("new");
    expect(exec.mock.calls[0][0]).toBe("pg_restore");
    expect(exec.mock.calls[0][1]).toEqual(expect.arrayContaining(["--clean", "--if-exists", "--single-transaction"]));
  });
});

describe("nextRunAt", () => {
  it("runs at 21:30 UTC the same day when that is still ahead", () => {
    expect(nextRunAt(new Date("2026-10-03T10:00:00Z")).toISOString()).toBe("2026-10-03T21:30:00.000Z");
  });
  it("rolls over to the next day after 21:30 UTC", () => {
    expect(nextRunAt(new Date("2026-10-03T21:30:00Z")).toISOString()).toBe("2026-10-04T21:30:00.000Z");
    expect(nextRunAt(new Date("2026-10-31T23:00:00Z")).toISOString()).toBe("2026-11-01T21:30:00.000Z");
  });
});

describe("backupTime", () => {
  it("reads the time back from a backup name", () => {
    expect(backupTime("backups/silora-2026-10-03T2130Z.dump")?.toISOString()).toBe("2026-10-03T21:30:00.000Z");
    expect(backupTime("backups/notes.txt")).toBeNull();
  });
});

describe("localStore (development backups)", () => {
  it("saves, lists and reads backups in a folder, keeping only the newest", async () => {
    const dir = await mkdtemp(join(tmpdir(), "silora-backups-"));
    try {
      const store = localStore(dir, 2);
      for (const day of ["01", "02", "03"]) await store.put(`backups/silora-2026-10-${day}T2130Z.dump`, Buffer.from(day));
      expect((await readdir(dir)).sort()).toEqual(["silora-2026-10-02T2130Z.dump", "silora-2026-10-03T2130Z.dump"]);
      expect(newestFirst(await store.list())[0]).toBe("backups/silora-2026-10-03T2130Z.dump");
      expect((await store.get("backups/silora-2026-10-03T2130Z.dump")).toString()).toBe("03");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("lists nothing when the folder does not exist yet", async () => {
    expect(await localStore(join(tmpdir(), "silora-missing-dir-xyz")).list()).toEqual([]);
  });

  it.each(["backups/../../.env", "uploads/x.dump", "backups/a/b.dump"])("rejects unsafe key %j", async (key) => {
    await expect(localStore(tmpdir()).put(key, Buffer.from("x"))).rejects.toThrow(/Invalid backup key/);
  });
});

describe("pgBinDir", () => {
  it("prefers PG_BIN when set", () => {
    expect(pgBinDir({ PG_BIN: "D:/pg/bin" } as unknown as NodeJS.ProcessEnv, "win32")).toBe("D:/pg/bin");
  });
  it("uses PATH outside Windows", () => {
    expect(pgBinDir({} as unknown as NodeJS.ProcessEnv, "linux")).toBeNull();
  });
  it("picks the newest PostgreSQL 17+ install on Windows", async () => {
    const base = await mkdtemp(join(tmpdir(), "pg-installs-"));
    try {
      for (const v of ["16", "17", "18"]) {
        await mkdir(join(base, v, "bin"), { recursive: true });
        await writeFile(join(base, v, "bin", "pg_dump.exe"), "");
      }
      expect(pgBinDir({} as unknown as NodeJS.ProcessEnv, "win32", base)).toBe(join(base, "18", "bin"));
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
