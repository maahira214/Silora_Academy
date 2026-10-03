import { addDaysToKey, dateOnlyKey, localDateKey, weekdayOfKey, zonedToUtc } from "@/lib/time";

export type RecurrenceRule = {
  weekdays: number[]; // 0 = Sunday
  startTime: string; // "HH:mm" local
  durationMin: number;
  timezone: string;
  validFrom: Date; // date-only
  validUntil: Date | null; // date-only, inclusive
};

export type Occurrence = { startsAt: Date; endsAt: Date };

/**
 * Expand a weekly rule into concrete lessons whose start falls inside
 * [from, to). Wall-clock time is kept across DST changes (18:00 stays 18:00).
 */
export function expandRecurrence(rule: RecurrenceRule, from: Date, to: Date): Occurrence[] {
  if (!rule.weekdays.length || rule.durationMin <= 0) return [];

  const firstKey = maxKey(dateOnlyKey(rule.validFrom), localDateKey(from, rule.timezone));
  const lastKey = minKey(
    rule.validUntil ? dateOnlyKey(rule.validUntil) : "9999-12-31",
    localDateKey(to, rule.timezone),
  );

  const out: Occurrence[] = [];
  for (let key = firstKey; key <= lastKey; key = addDaysToKey(key, 1)) {
    if (!rule.weekdays.includes(weekdayOfKey(key))) continue;
    const startsAt = zonedToUtc(key, rule.startTime, rule.timezone);
    if (startsAt < from || startsAt >= to) continue;
    out.push({ startsAt, endsAt: new Date(startsAt.getTime() + rule.durationMin * 60_000) });
  }
  return out;
}

const maxKey = (a: string, b: string) => (a > b ? a : b);
const minKey = (a: string, b: string) => (a < b ? a : b);

/** How far ahead lessons are materialised. The worker extends this daily. */
export const GENERATION_HORIZON_DAYS = 56;

export function describeRule(rule: Pick<RecurrenceRule, "weekdays" | "startTime" | "durationMin" | "timezone">) {
  const days = [...rule.weekdays].sort().map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]);
  const [h, m] = rule.startTime.split(":").map(Number);
  const time = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `Every ${days.join(", ")} at ${time} · ${rule.durationMin} min (${rule.timezone})`;
}
