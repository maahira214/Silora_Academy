import { describe, expect, it } from "vitest";
import { csvField, parseCsv } from "@/lib/csv";
import { checkImport } from "@/lib/people-import";

describe("parseCsv", () => {
  it("reads quotes, commas inside quotes, CRLF, a BOM and blank trailing lines", () => {
    const text = '﻿name,notes\r\n"Mehta, Aarav","said ""hi"""\r\nRiya,"two\nlines"\r\n,\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Mehta, Aarav", 'said "hi"'],
      ["Riya", "two\nlines"],
    ]);
  });

  it("round-trips values written with csvField", () => {
    const v = 'a "b", c';
    expect(parseCsv(`${csvField(v)},x`)).toEqual([[v, "x"]]);
  });
});

describe("checkImport", () => {
  const header = "Role,Full Name,Gmail,Phone,Class,Board,Title\n";

  it("accepts common header names and marks new, existing and broken rows", () => {
    const csv =
      header +
      "student,Aarav Mehta,AARAV@gmail.com,98765 43210,Grade 10,CBSE,\n" +
      "teacher,Rahul Verma,rahul@gmail.com,,,,Mathematics Teacher\n" +
      "parent,X,not-an-email,,,,\n";
    const { rows, error } = checkImport(csv, new Set(["rahul@gmail.com"]));
    expect(error).toBeUndefined();
    expect(rows.map((r) => [r.line, r.status])).toEqual([
      [2, "new"],
      [3, "exists"],
      [4, "error"],
    ]);
    expect(rows[0]).toMatchObject({ role: "STUDENT", email: "aarav@gmail.com", grade: "Grade 10", board: "CBSE" });
    expect(rows[1]).toMatchObject({ role: "TEACHER", headline: "Mathematics Teacher" });
    expect(rows[2].problems).toEqual(['Role must be "teacher" or "student"', "Name is missing", "Email is missing or not valid"]);
  });

  it("catches the same email twice in one file", () => {
    const { rows } = checkImport(header + "student,A One,a@x.com\nstudent,A Two,A@x.com\n", new Set());
    expect(rows[1].status).toBe("error");
    expect(rows[1].problems).toContain("Same email as row 2");
  });

  it("rejects bad timezones and needs the key columns", () => {
    expect(checkImport("role,name,email,timezone\nstudent,Sam Lee,s@x.com,Mars/Base\n", new Set()).rows[0].problems).toContain(
      'Unknown timezone "Mars/Base"',
    );
    expect(checkImport("name,email\nSam,s@x.com\n", new Set()).error).toMatch(/"role" column/);
    expect(checkImport("role,name,email\n", new Set()).error).toMatch(/at least one person/);
  });
});
