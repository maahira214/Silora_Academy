import { parseCsv } from "@/lib/csv";
import { isValidTimeZone } from "@/lib/time";

/**
 * Checks a teacher/student spreadsheet before anything is created. Pure, so the same
 * checks run for the preview and again on the server when importing.
 */

export const IMPORT_COLUMNS = [
  "role",
  "name",
  "email",
  "phone",
  "grade",
  "board",
  "teacher_title",
  "guardian_name",
  "guardian_phone",
  "guardian_email",
  "timezone",
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];

/** Other header names people commonly use for the same column. */
const ALIASES: Record<string, Column> = {
  type: "role",
  "full name": "name",
  "full_name": "name",
  gmail: "email",
  "google email": "email",
  "email address": "email",
  mobile: "phone",
  "phone number": "phone",
  class: "grade",
  curriculum: "board",
  title: "teacher_title",
  headline: "teacher_title",
  "parent name": "guardian_name",
  "parent phone": "guardian_phone",
  "parent email": "guardian_email",
  "time zone": "timezone",
};

export const MAX_IMPORT_ROWS = 1000;

export type ImportRow = {
  line: number;
  role: "TEACHER" | "STUDENT" | null;
  name: string;
  email: string;
  phone: string;
  grade: string;
  board: string;
  headline: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  timezone: string;
  /** "new" will be created, "exists" is skipped (email already registered), "error" needs fixing. */
  status: "new" | "exists" | "error";
  problems: string[];
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function columnFor(header: string): Column | null {
  const h = header.trim().toLowerCase().replace(/\s+/g, " ");
  if ((IMPORT_COLUMNS as readonly string[]).includes(h)) return h as Column;
  if ((IMPORT_COLUMNS as readonly string[]).includes(h.replace(/ /g, "_"))) return h.replace(/ /g, "_") as Column;
  return ALIASES[h] ?? null;
}

export function checkImport(csvText: string, existingEmails: Set<string>): { rows: ImportRow[]; error?: string } {
  const table = parseCsv(csvText);
  if (table.length < 2) return { rows: [], error: "The file needs a header row and at least one person." };
  const columns = table[0].map(columnFor);
  for (const need of ["role", "name", "email"] as const) {
    if (!columns.includes(need)) return { rows: [], error: `The header row needs a "${need}" column. Download the template to see the layout.` };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) return { rows: [], error: `Import at most ${MAX_IMPORT_ROWS} people at a time.` };

  const seen = new Map<string, number>();
  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (c: Column) => {
      const idx = columns.indexOf(c);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const roleText = get("role").toLowerCase();
    const role = roleText.startsWith("t") ? "TEACHER" : roleText.startsWith("s") ? "STUDENT" : null;
    const email = get("email").toLowerCase();
    const line = i + 2; // spreadsheet row number, counting the header
    const row: ImportRow = {
      line,
      role,
      name: get("name").replace(/\s+/g, " "),
      email,
      phone: get("phone"),
      grade: get("grade"),
      board: get("board"),
      headline: get("teacher_title"),
      guardianName: get("guardian_name"),
      guardianPhone: get("guardian_phone"),
      guardianEmail: get("guardian_email").toLowerCase(),
      timezone: get("timezone"),
      status: "new",
      problems: [],
    };

    if (!role) row.problems.push('Role must be "teacher" or "student"');
    if (row.name.length < 2) row.problems.push("Name is missing");
    if (!EMAIL.test(email)) row.problems.push("Email is missing or not valid");
    if (row.guardianEmail && !EMAIL.test(row.guardianEmail)) row.problems.push("Guardian email is not valid");
    if (row.timezone && !isValidTimeZone(row.timezone)) row.problems.push(`Unknown timezone "${row.timezone}"`);
    if (email && seen.has(email)) row.problems.push(`Same email as row ${seen.get(email)}`);
    else if (email) seen.set(email, line);

    if (row.problems.length) row.status = "error";
    else if (existingEmails.has(email)) row.status = "exists";
    return row;
  });
  return { rows };
}
