import { describe, expect, it } from "vitest";
import { deriveStatus, finalOutcome, joinWindow } from "@/lib/session-status";

const cfg = { joinOpensMinutesBefore: 10, teacherGraceMinutes: 5, studentGraceMinutes: 10 };
const start = new Date("2026-10-02T12:30:00Z");
const end = new Date("2026-10-02T13:30:00Z");
const at = (min: number) => new Date(start.getTime() + min * 60_000);
const base = { status: "SCHEDULED" as const, startsAt: start, endsAt: end, teacherJoined: false, studentsJoined: 0, studentsExpected: 1 };

describe("deriveStatus", () => {
  it("moves through scheduled → upcoming → open", () => {
    expect(deriveStatus(base, cfg, at(-120))).toBe("SCHEDULED");
    expect(deriveStatus(base, cfg, at(-30))).toBe("UPCOMING");
    expect(deriveStatus(base, cfg, at(-5))).toBe("OPEN");
  });

  it("is LIVE once someone joins after the start", () => {
    expect(deriveStatus({ ...base, teacherJoined: true, studentsJoined: 1 }, cfg, at(2))).toBe("LIVE");
  });

  it("flags a missing teacher only after the grace period", () => {
    const s = { ...base, studentsJoined: 1 };
    expect(deriveStatus(s, cfg, at(4))).toBe("LIVE");
    expect(deriveStatus(s, cfg, at(5))).toBe("TEACHER_NOT_JOINED");
  });

  it("flags a missing student after the student grace period", () => {
    const s = { ...base, teacherJoined: true };
    expect(deriveStatus(s, cfg, at(9))).toBe("LIVE");
    expect(deriveStatus(s, cfg, at(10))).toBe("STUDENT_NOT_JOINED");
  });

  it("flags when nobody joined", () => {
    expect(deriveStatus(base, cfg, at(6))).toBe("NO_ONE_JOINED");
  });

  it("never overrides a stored outcome", () => {
    expect(deriveStatus({ ...base, status: "CANCELLED" }, cfg, at(6))).toBe("CANCELLED");
  });

  it("is ENDED_PENDING after the end time", () => {
    expect(deriveStatus(base, cfg, at(61))).toBe("ENDED_PENDING");
  });
});

describe("finalOutcome", () => {
  it("decides the stored outcome", () => {
    expect(finalOutcome({ ...base, teacherJoined: true, studentsJoined: 1 })).toBe("COMPLETED");
    expect(finalOutcome({ ...base, studentsJoined: 1 })).toBe("TEACHER_ABSENT");
    expect(finalOutcome({ ...base, teacherJoined: true })).toBe("STUDENT_ABSENT");
    expect(finalOutcome(base)).toBe("NO_SHOW");
  });
});

describe("joinWindow", () => {
  it("opens N minutes before start and closes at the end", () => {
    expect(joinWindow(base, 10, at(-11))).toBe("not_yet");
    expect(joinWindow(base, 10, at(-10))).toBe("open");
    expect(joinWindow(base, 10, at(59))).toBe("open");
    expect(joinWindow(base, 10, at(60))).toBe("ended");
    expect(joinWindow({ ...base, status: "CANCELLED" }, 10, at(0))).toBe("cancelled");
  });
});
