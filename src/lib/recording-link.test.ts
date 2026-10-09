import { describe, expect, it } from "vitest";
import { parseDriveLink } from "@/lib/recording-link";

describe("parseDriveLink", () => {
  it.each([
    ["https://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOp/view?usp=sharing", "https://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOp/view"],
    ["  https://drive.google.com/open?id=1AbC_dEf-GhIjKlMnOp ", "https://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOp/view"],
  ])("accepts %s", (input, out) => {
    expect(parseDriveLink(input)).toBe(out);
  });

  it.each([
    "http://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOp/view",
    "https://youtube.com/watch?v=abc",
    "https://drive.google.com.evil.example/file/d/1AbC_dEf-GhIjKlMnOp",
    "https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOp",
    "not a link",
  ])("rejects %s", (input) => {
    expect(parseDriveLink(input)).toBeNull();
  });
});
