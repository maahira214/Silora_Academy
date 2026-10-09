"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/authz";
import { UserError } from "@/lib/action-result";
import { parseCsv } from "@/lib/csv";
import { checkImport, type ImportRow } from "@/lib/people-import";
import { createUser } from "@/server/users";

/** Only messages meant for people are shown; anything unexpected is logged. */
function friendly(e: unknown) {
  if (e instanceof UserError || e instanceof ForbiddenError) return e.message;
  console.error(e);
  return "Something went wrong. Please try again.";
}

export type PreviewResult = { error?: string; rows?: ImportRow[] };
export type ImportResult = { error?: string; created?: number; skipped?: number; failed?: { line: number; message: string }[] };

async function check(csvText: string) {
  if (csvText.length > 2_000_000) return { rows: [], error: "That file is too big. Split it into smaller files." };
  // Which of the file's emails are already registered (emails are unique across the app)
  const emails = parseCsv(csvText)
    .flat()
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.includes("@"));
  const existing = await db.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
  return checkImport(csvText, new Set(existing.map((u) => u.email)));
}

/** Step 1: check the spreadsheet and show what would happen. Creates nothing. */
export async function previewImportAction(csvText: string): Promise<PreviewResult> {
  try {
    await requirePermission("people.edit");
    return await check(csvText);
  } catch (e) {
    return { error: friendly(e) };
  }
}

/** Step 2: create everyone marked "new". Rows that already exist or have problems are skipped. */
export async function importPeopleAction(csvText: string): Promise<ImportResult> {
  try {
    const actor = await requirePermission("people.edit");
    const { rows, error } = await check(csvText);
    if (error) return { error };

    let created = 0;
    const failed: { line: number; message: string }[] = [];
    for (const r of rows) {
      if (r.status !== "new" || !r.role) continue;
      try {
        await createUser(actor, r.role, {
          name: r.name,
          email: r.email,
          phone: r.phone || null,
          timezone: r.timezone || null,
          headline: r.headline || null,
          grade: r.grade || null,
          board: r.board || null,
          guardianName: r.guardianName || null,
          guardianPhone: r.guardianPhone || null,
          guardianEmail: r.guardianEmail || null,
        });
        created++;
      } catch (e) {
        failed.push({ line: r.line, message: friendly(e) });
      }
    }
    const skipped = rows.length - created - failed.length;
    await audit({ orgId: actor.orgId, actorId: actor.id, action: "PEOPLE_IMPORTED", metadata: { created, skipped, failed: failed.length } });
    revalidatePath("/admin", "layout");
    return { created, skipped, failed };
  } catch (e) {
    return { error: friendly(e) };
  }
}
