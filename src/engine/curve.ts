import { addDays, daysBetween } from "./dates";
import type { PlanDay } from "./types";

export const FLOOR = 1;

/**
 * Exponential decay coefficient for a taper of `taperDays` days starting at
 * `baseline` and ending at FLOOR on the last taper day.
 */
export function decayK(baseline: number, taperDays: number): number {
  if (taperDays <= 1) return Infinity;
  return Math.log(baseline / FLOOR) / (taperDays - 1);
}

/**
 * Build the full plan: taper days from startDate through the day before
 * quitDate (allowance >= 1), plus the quit date itself at 0.
 *
 * raw(t) = B * exp(-k * t), rounded half-up, clamped to >= FLOOR and to be
 * monotonically non-increasing.
 */
export function buildCurve(
  baseline: number,
  startDate: string,
  quitDate: string,
): PlanDay[] {
  const taperDays = daysBetween(startDate, quitDate);
  if (taperDays < 1) {
    throw new Error("quitDate must be after startDate");
  }
  const k = decayK(baseline, taperDays);
  const days: PlanDay[] = [];
  let prev = Infinity;
  for (let t = 0; t < taperDays; t++) {
    const raw =
      taperDays === 1 ? FLOOR : baseline * Math.exp(-k * t);
    // Math.round is half-up for positive values.
    let allowance = Math.max(FLOOR, Math.round(raw));
    if (allowance > prev) allowance = prev;
    prev = allowance;
    days.push({
      date: addDays(startDate, t),
      dayIndex: t,
      plannedAllowance: allowance,
      adjustedAllowance: allowance,
    });
  }
  days.push({
    date: quitDate,
    dayIndex: taperDays,
    plannedAllowance: 0,
    adjustedAllowance: 0,
  });
  return days;
}
