"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Button, Card, cx } from "@/components/ui";

type Option = { id: string; name: string; detail?: string | null };

const STEPS = ["Who", "Meet link", "Schedule"] as const;

/**
 * New class in three short steps: who, Meet link, schedule. All steps stay in one form
 * (hidden, not removed) so nothing typed is lost when going back and forth.
 */
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
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"ONE_TO_ONE" | "GROUP">("ONE_TO_ONE");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stepError, setStepError] = useState<string | null>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visible = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()) || selected.has(s.id)),
    [students, filter, selected],
  );

  /** Checks the fields on the current step before moving on. */
  const next = () => {
    const fields = stepRefs.current[step]?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select, textarea") ?? [];
    for (const f of fields) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return;
      }
    }
    if (step === 0 && type === "GROUP" && selected.size === 0) {
      setStepError("Choose at least one student for the group.");
      return;
    }
    setStepError(null);
    setStep(step + 1);
  };

  return (
    <ActionForm action={action} className="space-y-5">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="timezone" value={defaultTz} />

      <ol className="flex gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cx(
              "flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold",
              i === step ? "bg-navy-800 text-white" : i < step ? "bg-gold-100 text-gold-800" : "bg-white text-slate-500 ring-1 ring-slate-200",
            )}
          >
            <span className={cx("grid size-6 place-items-center rounded-full text-xs", i === step ? "bg-gold-500 text-navy-900" : "bg-white/70")}>
              {i < step ? "✓" : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {/* Step 1: who */}
      <div ref={(el) => void (stepRefs.current[0] = el)} className={cx(step !== 0 && "hidden")}>
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-navy-900">Who is in this class?</h2>
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
                <span className="mb-1.5 block text-sm font-semibold text-slate-800">Students ({selected.size} chosen)</span>
                <Input placeholder="Find a student…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 max-w-xs" />
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
          </div>

          <details className="rounded-xl bg-slate-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">More details (optional): grade, board, class name</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Grade">
                <Input name="grade" placeholder="Grade 10" />
              </Field>
              <Field label="Board">
                <Select name="board" defaultValue="">
                  <option value="">—</option>
                  {boards.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Class name" hint="Leave empty for “Subject — Student” or “Subject — Grade group”." className="sm:col-span-2">
                <Input name="title" />
              </Field>
            </div>
          </details>
        </Card>
      </div>

      {/* Step 2: Meet link */}
      <div ref={(el) => void (stepRefs.current[1] = el)} className={cx(step !== 1 && "hidden")}>
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Google Meet link</h2>
            <p className="text-sm text-slate-600">One link for this class, used for every lesson.</p>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Signed in to <strong>Silora&apos;s Google account</strong>, open <span className="font-semibold">meet.google.com</span> →{" "}
              <em>New meeting</em> → <em>Create a meeting for later</em>.
            </li>
            <li>Copy the link and paste it below. Each class needs its own new meeting.</li>
          </ol>
          <Field label="Meet link" hint="You can skip this and add it later from the class page.">
            <Input name="meetLink" placeholder="https://meet.google.com/abc-defg-hij" />
          </Field>
        </Card>
      </div>

      {/* Step 3: schedule */}
      <div ref={(el) => void (stepRefs.current[2] = el)} className={cx(step !== 2 && "hidden")}>
        <Card className="space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Weekly schedule</h2>
            <p className="text-sm text-slate-600">Lessons are created automatically. You can add more times or one-off lessons later.</p>
          </div>
          {scheduleFields}
        </Card>
      </div>

      {stepError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
          {stepError}
        </p>
      )}

      <div className="flex justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={next}>
            Next
          </Button>
        ) : (
          <SubmitButton size="lg">Create class</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
