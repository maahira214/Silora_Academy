import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { r2Driver } = await import("@/server/storage");

const env = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "AKTEST",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "silora-files",
} as unknown as NodeJS.ProcessEnv;

afterEach(() => vi.unstubAllGlobals());

describe("r2Driver", () => {
  it("refuses to start without credentials", () => {
    expect(() => r2Driver({ R2_BUCKET: "x" } as unknown as NodeJS.ProcessEnv)).toThrow(/R2_ACCOUNT_ID/);
  });

  it("uploads with a signed PUT to the bucket URL", async () => {
    const fetchMock = vi.fn(async (_req: Request) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await r2Driver(env).put("uploads/2026/10/abc.pdf", Buffer.from("%PDF-1"), "application/pdf");

    const req = fetchMock.mock.calls[0][0];
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("https://acct123.r2.cloudflarestorage.com/silora-files/uploads/2026/10/abc.pdf");
    expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKTEST\/\d{8}\/auto\/s3\//);
    expect(req.headers.get("content-type")).toBe("application/pdf");
  });

  it("downloads file bytes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("hello", { status: 200 })));
    const data = await r2Driver(env).get("uploads/2026/10/abc.txt");
    expect(data.toString()).toBe("hello");
  });

  it("surfaces R2 errors instead of returning empty files", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("NoSuchKey", { status: 404 })));
    await expect(r2Driver(env).get("uploads/missing.pdf")).rejects.toThrow(/404/);
  });

  it.each(["../secrets.txt", "uploads/../../x", "uploads/a b.pdf", "uploads/a?x=1"])("rejects unsafe key %j", async (key) => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(r2Driver(env).get(key)).rejects.toThrow(/Invalid storage key/);
  });
});
