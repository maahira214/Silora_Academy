"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Card, CardHeader, cx } from "@/components/ui";

type Option = { id: string; name: string; detail?: string | null };

export function CourseForm({
  action,
  teachers,
  students,
  subjects,
  boards,
  scheduleFields,
  defaultTz,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  teachers: Option[];
  students: Option[];
  subjects: string[];
  boards: string[];
  scheduleFields: ReactNode;
  defaultTz: string;
}) {
  const [type, setType] = useState<"ONE_TO_ONE" | "GROUP">("ONE_TO_ONE");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()) || selected.has(s.id)),
    [students, filter, selected],
  );

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="timezone" value={defaultTz} />

      <Card>
        <CardHeader title="1. Who is in this class?" subtitle="One class = one Silora relationship = one permanent Google Meet link." />
        <div className="space-y-5 p-5">
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(
              [
                ["ONE_TO_ONE", "One-to-one"],
                ["GROUP", "Group class"],
              ] as const
            ).map(([v, label]) => (
              <button
                type="button"
                key={v}
                onClick={() => setType(v)}
                className={cx("rounded-full px-4 py-2 text-sm font-semibold", type === v ? "bg-white text-navy-900 shadow-sm" : "text-slate-600")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject">
              <Input name="subject" list="subjects" required placeholder="Mathematics" />
              <datalist id="subjects">
                {subjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Teacher">
              <Select name="teacherId" required defaultValue="">
                <option value="" disabled>
                  Choose a teacher
                </option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.detail ? ` — ${t.detail}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {type === "ONE_TO_ONE" ? (
              <Field label="Student">
                <Select name="studentId" required defaultValue="">
                  <option value="" disabled>
                    Choose a student
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.detail ? ` — ${s.detail}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-slate-800">Students ({selected.size} selected)</span>
                <Input placeholder="Filter students…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 max-w-xs" />
                <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl p-2 ring-1 ring-slate-200 sm:grid-cols-2">
                  {visible.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        name="studentIds"
                        value={s.id}
                        checked={selected.has(s.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          setSelected(next);
                        }}
                        className="size-4 accent-navy-800"
                      />
                      <span className="font-medium">{s.name}</span>
                      {s.detail && <span className="text-xs text-slate-500">{s.detail}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Field label="Grade (optional)">
              <Input name="grade" placeholder="Grade 10" />
            </Field>
            <Field label="Board (optional)">
              <Select name="board" defaultValue="">
                <option value="">—</option>
                {boards.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Class name (optional)" hint="Defaults to “Subject — Student” or “Subject — Grade group”." className="sm:col-span-2">
              <Input name="title" />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Google Meet link" subtitle="Reused for every lesson of this class." />
        <div className="space-y-3 p-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Signed in to <strong>Silora&apos;s Google account</strong>, open <span className="font-semibold">meet.google.com</span> →{" "}
              <em>New meeting</em> → <em>Create a meeting for later</em>.
            </li>
            <li>Paste the link here. Use a new meeting for each class; the app won&apos;t accept a link that&apos;s already in use.</li>
          </ol>
          <Field label="Meet link" hint="You can also add it later from the class page.">
            <Input name="meetLink" placeholder="https://meet.google.com/abc-defg-hij" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="3. Weekly schedule" subtitle="Lessons are created automatically. You can add more schedules or one-off lessons later." />
        <div className="p-5">{scheduleFields}</div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton size="lg">Create class</SubmitButton>
      </div>
    </ActionForm>
  );
}
