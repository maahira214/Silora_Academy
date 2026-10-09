"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ImportRow } from "@/lib/people-import";
import { Badge, Button, Card, Notice, buttonClass, cx } from "@/components/ui";
import { importPeopleAction, previewImportAction, type ImportResult } from "./actions";

const STATUS = {
  new: { label: "Will be added", tone: "success" },
  exists: { label: "Already registered", tone: "neutral" },
  error: { label: "Needs fixing", tone: "danger" },
} as const;

/** Upload or paste a spreadsheet → check it → add everyone who's ready. */
export function ImportPeople() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setRows(null);
    setError(null);
    setResult(null);
  };
  const preview = () =>
    start(async () => {
      reset();
      const r = await previewImportAction(csv);
      if (r.error) setError(r.error);
      else setRows(r.rows ?? []);
    });
  const runImport = () =>
    start(async () => {
      const r = await importPeopleAction(csv);
      if (r.error) setError(r.error);
      else setResult(r);
    });

  const count = (s: ImportRow["status"]) => rows?.filter((r) => r.status === s).length ?? 0;

  if (result) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-xl font-bold text-navy-900">Import finished</h2>
        <ul className="space-y-1 text-base">
          <li>
            ✅ <strong>{result.created}</strong> {result.created === 1 ? "person" : "people"} added
          </li>
          <li>↷ {result.skipped} skipped (already registered or needing fixes)</li>
          {!!result.failed?.length && <li className="text-red-700">✗ {result.failed.length} could not be added</li>}
        </ul>
        {!!result.failed?.length && (
          <ul className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {result.failed.map((f) => (
              <li key={f.line}>
                Row {f.line}: {f.message}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-600">They can sign in with Google using the email you gave. Nobody is emailed about this yet.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/people" className={buttonClass("primary", "lg")}>
            Go to People
          </Link>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              reset();
              setCsv("");
              setFileName(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-navy-900">1. Choose the spreadsheet</h2>
          <p className="text-sm text-slate-600">
            Save it as CSV from Excel or Google Sheets (File → Download → CSV). Needed columns: <strong>role</strong> (teacher or student),{" "}
            <strong>name</strong>, <strong>email</strong> (their Google account). Optional: phone, grade, board, teacher_title, guardian_name,
            guardian_phone, guardian_email, timezone.
          </p>
          <a href="/admin/people/import/template" download className="mt-2 inline-block text-sm font-semibold text-gold-700 hover:underline">
            Download a template
          </a>
        </div>
        <label className={cx(buttonClass("secondary", "lg"), "cursor-pointer")}>
          {fileName ? `Chosen: ${fileName}` : "Choose CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              setCsv(await f.text());
              reset();
            }}
          />
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">Or paste the rows instead</summary>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setFileName(null);
              reset();
            }}
            rows={6}
            placeholder={"role,name,email,phone,grade,board\nstudent,Aarav Mehta,aarav@gmail.com,98765 43210,Grade 10,CBSE"}
            className="mt-2 w-full rounded-xl border-0 p-3 font-mono text-xs ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-gold-500"
          />
        </details>
        <Button size="lg" onClick={preview} disabled={!csv.trim() || pending}>
          {pending && !rows ? "Checking…" : "2. Check the file"}
        </Button>
      </Card>

      {error && <Notice tone="danger">{error}</Notice>}

      {rows && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
            <Badge tone="success">{count("new")} will be added</Badge>
            <Badge>{count("exists")} already registered</Badge>
            {count("error") > 0 && <Badge tone="danger">{count("error")} need fixing</Badge>}
            <div className="flex-1" />
            <Button size="lg" onClick={runImport} disabled={pending || count("new") === 0}>
              {pending ? "Adding…" : `3. Add ${count("new")} ${count("new") === 1 ? "person" : "people"}`}
            </Button>
          </div>
          {count("error") > 0 && (
            <p className="border-b border-slate-100 bg-red-50 px-5 py-3 text-sm text-red-800">
              Rows that need fixing are skipped. Fix them in the spreadsheet and import the file again later; people already added are skipped
              automatically.
            </p>
          )}
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.line} className={cx(r.status === "error" && "bg-red-50/50")}>
                    <td className="px-4 py-2 tabular-nums text-slate-500">{r.line}</td>
                    <td className="px-4 py-2">
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </td>
                    <td className="px-4 py-2">{r.role === "TEACHER" ? "Teacher" : r.role === "STUDENT" ? "Student" : "—"}</td>
                    <td className="px-4 py-2 font-semibold text-navy-900">{r.name || "—"}</td>
                    <td className="px-4 py-2">{r.email || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.problems.length ? (
                        <span className="text-red-700">{r.problems.join(" · ")}</span>
                      ) : (
                        [r.headline, r.grade, r.board, r.phone].filter(Boolean).join(" · ") || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
