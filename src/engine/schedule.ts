import { parseHM } from "./dates";

export type DaySchedule = {
  /** Slot times in minutes from midnight of the logical day, ascending. */
  slots: number[];
  /** Minimum spacing between pouches, in minutes. */
  intervalMin: number;
};

/**
 * Evenly spaced slots across the waking window. When allowance is 1 or 2 the
 * slots are the user's pinned anchor times instead, but intervalMin is still
 * derived from the window so the spacing rule stays meaningful.
 */
export function buildDaySchedule(
  allowance: number,
  wakeTime: string,
  sleepTime: string,
  anchors?: string[],
): DaySchedule {
  if (allowance <= 0) return { slots: [], intervalMin: 0 };
  const start = parseHM(wakeTime);
  const windowMin = parseHM(sleepTime) - start;
  const intervalMin = windowMin / allowance;
  if (allowance <= 2 && anchors && anchors.length >= allowance) {
    return { slots: anchors.slice(0, allowance).map(parseHM), intervalMin };
  }
  const slots = Array.from(
    { length: allowance },
    (_, i) => start + i * intervalMin,
  );
  return { slots, intervalMin };
}

/**
 * When the next pouch is allowed, in minutes from midnight of the logical day.
 *
 * - null means the daily cap is reached (enforced in Travel Mode too).
 * - In Travel Mode the interval gate is suspended: any time is allowed.
 * - Otherwise: max(next unused slot, last log + interval). Logging early
 *   shifts the remaining slots later automatically because the next slot is
 *   indexed by count used, and the last-log spacing pushes it out.
 */
export function nextAllowedMinute(
  sched: DaySchedule,
  logMinutes: number[],
  allowance: number,
  travelMode: boolean,
): number | null {
  if (logMinutes.length >= allowance) return null;
  if (travelMode) return 0;
  const slot = sched.slots[logMinutes.length];
  const last = logMinutes[logMinutes.length - 1];
  return last === undefined ? slot : Math.max(slot, last + sched.intervalMin);
}

/** A log is `early` only outside Travel Mode, when it lands before its time. */
export function isEarly(
  nowMin: number,
  nextAllowed: number | null,
  travelMode: boolean,
): boolean {
  if (travelMode || nextAllowed === null) return false;
  return nowMin < nextAllowed;
}
