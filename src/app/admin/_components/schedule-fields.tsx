import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/time";
import { Field, Input, Select } from "@/components/forms";

/** Weekly recurrence inputs: days, time, duration, timezone, date range. */
export function ScheduleFields({ defaultTz, today, withTimezone = true }: { defaultTz: string; today: string; withTimezone?: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-800">Repeats every</span>
        <div className="flex flex-wrap gap-2">
          {/* Monday-first for readability */}
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="weekdays" value={d} className="peer sr-only" />
              <span className="inline-flex h-10 w-12 items-center justify-center rounded-xl text-sm font-semibold ring-1 ring-slate-300 peer-checked:bg-navy-800 peer-checked:text-white peer-checked:ring-navy-800 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500">
                {WEEKDAYS[d]}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start time">
          <Input type="time" name="startTime" defaultValue="18:00" />
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" name="durationMin" min={15} max={300} step={5} defaultValue={60} />
        </Field>
        {withTimezone && (
          <Field label="Schedule timezone">
            <Select name="timezone" defaultValue={defaultTz}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Starts on">
          <Input type="date" name="validFrom" defaultValue={today} />
        </Field>
        <Field label="Ends on" hint="Optional — leave empty to continue until changed.">
          <Input type="date" name="validUntil" />
        </Field>
      </div>
    </div>
  );
}
