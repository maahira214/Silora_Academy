import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { getCurrentUser } from "@/lib/auth/session";
import { IMPORT_COLUMNS } from "@/lib/people-import";

// Spreadsheet template for /admin/people/import, with one example teacher and student.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "people.edit")) return new NextResponse("Not found", { status: 404 });
  const csv = [
    IMPORT_COLUMNS.join(","),
    "teacher,Rahul Verma,rahul.example@gmail.com,98765 43210,,,Mathematics Teacher,,,,",
    "student,Aarav Mehta,aarav.example@gmail.com,98765 11111,Grade 10,CBSE,,Sunita Mehta,98765 22222,sunita.example@gmail.com,",
  ].join("\r\n");
  return new NextResponse(csv + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="silora-people-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
