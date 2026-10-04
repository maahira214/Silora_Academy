import { describe, expect, it } from "vitest";
import { canJoin, durationText, lessonPhase, pastLessonLabel, phaseLabel } from "@/lib/lesson-phase";

const lesson = { status: "SCHEDULED" as const, startsAt: new Date("2026-10-05T12:30:00Z"), endsAt: new Date("2026-10-05T13:30:00Z") };
const at = (iso: string) => new Date(iso);

describe("lessonPhase", () => {
  it.each([
    ["2026-10-05T10:00:00Z", "later"],
    ["2026-10-05T11:31:00Z", "soon"],
    ["2026-10-05T12:19:59Z", "soon"],
    ["2026-10-05T12:20:00Z", "open"], // join opens 10 minutes before
    ["2026-10-05T12:30:00Z", "in_progress"],
    ["2026-10-05T13:29:59Z", "in_progress"],
    ["2026-10-05T13:30:00Z", "finished"],
  ])("at %s the lesson is %s", (now, phase) => {
    expect(lessonPhase(lesson, 10, at(now))).toBe(phase);
  });

  it("treats cancelled lessons as cancelled at any time", () => {
    expect(lessonPhase({ ...lesson, status: "CANCELLED" }, 10, at("2026-10-05T12:40:00Z"))).toBe("cancelled");
  });

  it("treats lessons with a final outcome as finished", () => {
    expect(lessonPhase({ ...lesson, status: "COMPLETED" }, 10, at("2026-10-05T12:40:00Z"))).toBe("finished");
  });

  it("allows joining only while open or in progress", () => {
    expect(["later", "soon", "open", "in_progress", "finished", "cancelled"].filter((p) => canJoin(p as never))).toEqual(["open", "in_progress"]);
  });
});

describe("plain-word labels", () => {
  it.each([
    [30_000, "less than a minute"],
    [60_000, "1 min"],
    [7 * 60_000 + 1, "8 min"],
    [60 * 60_000, "1 hr"],
    [65 * 60_000, "1 hr 5 min"],
  ])("durationText(%i) = %s", (ms, text) => {
    expect(durationText(ms)).toBe(text);
  });

  it("uses the words from the build plan", () => {
    const now = at("2026-10-05T12:22:00Z");
    expect(phaseLabel("soon", lesson.startsAt, now, "6:00 PM")).toBe("Starts in 8 min");
    expect(phaseLabel("later", lesson.startsAt, now, "6:00 PM")).toBe("Starts at 6:00 PM");
    expect(phaseLabel("open", lesson.startsAt, now, "6:00 PM")).toBe("Join now");
    expect(phaseLabel("in_progress", lesson.startsAt, now, "6:00 PM")).toBe("Class in progress");
    expect(phaseLabel("finished", lesson.startsAt, now, "6:00 PM")).toBe("Finished");
  });
});

describe("pastLessonLabel", () => {
  it("speaks to the viewer", () => {
    expect(pastLessonLabel("TEACHER_ABSENT", "STUDENT").label).toBe("Teacher didn't join");
    expect(pastLessonLabel("TEACHER_ABSENT", "TEACHER").label).toBe("You didn't join");
    expect(pastLessonLabel("COMPLETED", "STUDENT").label).toBe("Finished");
    expect(pastLessonLabel("NO_SHOW", "TEACHER").label).toBe("Nobody joined");
  });
});
