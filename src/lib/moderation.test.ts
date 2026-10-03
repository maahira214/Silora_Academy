import { describe, expect, it } from "vitest";
import { detectContactInfo } from "@/lib/moderation";
import { parseMeetLink } from "@/lib/meet";

describe("detectContactInfo", () => {
  it.each([
    ["You can WhatsApp me at 98765 43210", ["PHONE_NUMBER", "MESSAGING_APP"]],
    ["call +91-98765-43210", ["PHONE_NUMBER"]],
    ["my number is nine eight seven six five four three two one zero", ["PHONE_NUMBER", "CONTACT_REQUEST"]],
    ["mail me: rahul.t@gmail.com", ["EMAIL"]],
    ["rahul dot t at gmail dot com", ["EMAIL"]],
    ["follow me on insta", ["MESSAGING_APP"]],
    ["add me @rahul_maths", ["SOCIAL_HANDLE"]],
    ["send me your number", ["CONTACT_REQUEST"]],
    ["join t.me/mygroup", ["MESSAGING_APP"]],
  ])("flags %j", (text, expected) => {
    expect(detectContactInfo(text)).toEqual(expect.arrayContaining(expected));
  });

  it.each([
    "Please complete questions 1–10 from the worksheet.",
    "Solve 2x + 3 = 11 and 3x - 4 = 20",
    "Chapter 12, page 145, exercise 3.2",
    "The 2024-2025 syllabus changed",
    "Area = 3.14 * 7 * 7",
    "See https://www.khanacademy.org/math/algebra",
  ])("does not flag normal teaching text %j", (text) => {
    expect(detectContactInfo(text)).toEqual([]);
  });
});

describe("parseMeetLink", () => {
  it("accepts the usual Meet link forms", () => {
    expect(parseMeetLink("https://meet.google.com/abc-defg-hij")).toEqual({ code: "abc-defg-hij", url: "https://meet.google.com/abc-defg-hij" });
    expect(parseMeetLink(" meet.google.com/ABC-DEFG-HIJ?authuser=1 ")?.code).toBe("abc-defg-hij");
  });

  it("rejects anything else", () => {
    expect(parseMeetLink("https://zoom.us/j/123")).toBeNull();
    expect(parseMeetLink("https://meet.google.com.evil.com/abc-defg-hij")).toBeNull();
    expect(parseMeetLink("abc-defg-hij")).toBeNull();
  });
});
