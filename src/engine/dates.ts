/**
 * Date helpers for the plan engine. Calendar math is done in UTC on ISO date
 * strings so it is immune to DST; wall-clock logic (dateKey, slot times) uses
 * the device's local time, which is the user's timezone in practice.
 */

export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

/**
 * Resolve which logical day a timestamp belongs to. A "day" runs from
 * rolloverHour to rolloverHour local time, so 01:30 belongs to the previous
 * calendar date when rolloverHour is 4.
 */
export function dateKeyFor(ts: Date, rolloverHour: number): string {
  const shifted = new Date(ts.getTime() - rolloverHour * 3_600_000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "HH:MM" -> minutes from midnight. */
export function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes from midnight -> "HH:MM". */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
