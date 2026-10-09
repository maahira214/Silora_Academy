import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/email-template";

describe("renderEmail", () => {
  const e = renderEmail({
    name: "Aarav Mehta",
    title: "Lesson cancelled",
    body: "Your Mathematics lesson on Tue, 6 Oct · 6:00 PM has been cancelled.",
    url: "https://app.siloraacademy.com/classes/abc",
  });

  it("greets by first name and links into the app", () => {
    expect(e.subject).toBe("Lesson cancelled · Silora Academy");
    expect(e.text).toContain("Hello Aarav,");
    expect(e.text).toContain("Open Silora Academy: https://app.siloraacademy.com/classes/abc");
    expect(e.html).toContain('href="https://app.siloraacademy.com/classes/abc"');
    expect(e.html).toContain('src="https://app.siloraacademy.com/brand/logo-dark.png"');
  });

  it("escapes text so names and class titles can't inject HTML", () => {
    const x = renderEmail({ name: "<b>Eve</b>", title: "A & B", body: '<script>alert("x")</script>', url: "https://x.test/" });
    expect(x.html).not.toContain("<script>");
    expect(x.html).toContain("&lt;script&gt;");
    expect(x.html).toContain("A &amp; B");
  });
});
