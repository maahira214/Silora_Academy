import { TZDate, tz } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * All instants are stored in UTC. Recurring schedules are defined in a local
 * timezone ("Mon/Wed/Fri 18:00 Asia/Kolkata") and every user sees times in
 * their own timezone.
 *
 * Date-only values (schedule validFrom/validUntil) are stored as UTC midnight
 * of the local calendar date, i.e. 2026-10-05 → 2026-10-05T00:00:00Z.
 */

export const DEFAULT_TZ = "Asia/Kolkata";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
] as const;

/** "YYYY-MM-DD" → date-only value (UTC midnight). */
export function dateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateOnlyKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Local calendar date ("YYYY-MM-DD") of an instant in a timezone. */
export function localDateKey(instant: Date, timeZone: string): string {
  return format(instant, "yyyy-MM-dd", { in: tz(timeZone) });
}

/** Local wall-clock date + "HH:mm" in a timezone → UTC instant. */
export function zonedToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, timeZone).getTime());
}

/** [start, end) of a local calendar day, as UTC instants. */
export function localDayRange(dateKey: string, timeZone: string): [Date, Date] {
  const start = zonedToUtc(dateKey, "00:00", timeZone);
  const next = addDaysToKey(dateKey, 1);
  return [start, zonedToUtc(next, "00:00", timeZone)];
}

export function addDaysToKey(key: string, days: number): string {
  const d = dateOnly(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnlyKey(d);
}

export const weekdayOfKey = (key: string) => dateOnly(key).getUTCDay();

export function fmt(instant: Date, timeZone: string, pattern: string) {
  return format(instant, pattern, { in: tz(timeZone) });
}

export const fmtTime = (d: Date, timeZone: string) => fmt(d, timeZone, "h:mm a");
export const fmtDate = (d: Date, timeZone: string) => fmt(d, timeZone, "EEE, d MMM yyyy");
export const fmtDateTime = (d: Date, timeZone: string) => fmt(d, timeZone, "EEE, d MMM · h:mm a");

/** Short timezone label, e.g. "IST" / "GST" / "GMT+4". */
export function tzLabel(d: Date, timeZone: string) {
  const part = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
