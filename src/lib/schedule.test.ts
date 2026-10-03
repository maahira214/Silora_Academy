import { describe, expect, it } from "vitest";
import { expandRecurrence, describeRule } from "@/lib/schedule";
import { dateOnly } from "@/lib/time";

const rule = (over: Partial<Parameters<typeof expandRecurrence>[0]> = {}) => ({
  weekdays: [1, 3, 5], // Mon, Wed, Fri
  startTime: "18:00",
  durationMin: 60,
  timezone: "Asia/Kolkata",
  validFrom: dateOnly("2026-10-01"),
  validUntil: null,
  ...over,
});

describe("expandRecurrence", () => {
  it("creates Mon/Wed/Fri 6 PM IST lessons as UTC instants", () => {
    const out = expandRecurrence(rule(), new Date("2026-10-01T00:00:00Z"), new Date("2026-10-08T00:00:00Z"));
    // Fri 2, Mon 5, Wed 7 October
    expect(out.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-10-02T12:30:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "2026-10-07T12:30:00.000Z",
    ]);
    expect(out[0].endsAt.getTime() - out[0].startsAt.getTime()).toBe(60 * 60_000);
  });

  it("respects validFrom and validUntil (inclusive)", () => {
    const out = expandRecurrence(
      rule({ validFrom: dateOnly("2026-10-05"), validUntil: dateOnly("2026-10-07") }),
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-12-01T00:00:00Z"),
    );
    expect(out).toHaveLength(2); // Mon 5, Wed 7
  });

  it("skips lessons that already started before `from`", () => {
    const out = expandRecurrence(rule(), new Date("2026-10-02T13:00:00Z"), new Date("2026-10-06T00:00:00Z"));
    expect(out.map((o) => o.startsAt.toISOString())).toEqual(["2026-10-05T12:30:00.000Z"]);
  });

  it("keeps the wall-clock time across a DST change (London)", () => {
    // UK clocks go back on Sun 25 Oct 2026
    const out = expandRecurrence(
      rule({ timezone: "Europe/London", weekdays: [6, 1] }),
      new Date("2026-10-20T00:00:00Z"),
      new Date("2026-10-28T00:00:00Z"),
    );
    expect(out.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-10-24T17:00:00.000Z", // 18:00 BST
      "2026-10-26T18:00:00.000Z", // 18:00 GMT
    ]);
  });

  it("returns nothing for an empty rule", () => {
    expect(expandRecurrence(rule({ weekdays: [] }), new Date(0), new Date())).toEqual([]);
  });

  it("describes a rule in plain English", () => {
    expect(describeRule(rule())).toBe("Every Mon, Wed, Fri at 6:00 PM · 60 min (Asia/Kolkata)");
  });
});
