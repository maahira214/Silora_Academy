import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits, retryText } from "@/lib/rate-limit";

const limit = { limit: 3, windowMs: 60_000 };

beforeEach(() => resetRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit, then refuses until the window resets", () => {
    const t = 1_000_000;
    expect([1, 2, 3].map(() => rateLimit("ip:1", limit, t).ok)).toEqual([true, true, true]);
    const blocked = rateLimit("ip:1", limit, t + 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(50_000);
    expect(rateLimit("ip:1", limit, t + 60_000).ok).toBe(true);
  });

  it("counts each key separately", () => {
    for (let i = 0; i < 3; i++) rateLimit("user:a", limit);
    expect(rateLimit("user:a", limit).ok).toBe(false);
    expect(rateLimit("user:b", limit).ok).toBe(true);
  });

  it("words the wait plainly", () => {
    expect(retryText(30_000)).toBe("in a minute");
    expect(retryText(4 * 60_000 + 1)).toBe("in 5 minutes");
  });
});
