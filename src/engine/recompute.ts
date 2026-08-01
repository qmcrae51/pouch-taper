import { buildCurve, decayK } from "./curve";
import { addDays, daysBetween } from "./dates";
import type { PlanDay, UsedByDate } from "./types";

/** Steeper than a 15% reduction per day means the runway is very compressed. */
export const MAX_DAILY_REDUCTION = 0.15;
export const MAX_K = -Math.log(1 - MAX_DAILY_REDUCTION);

/**
 * Trailing average of actual daily use over the `days` ending at `endKey`,
 * counting only days that have logs.
 */
export function trailingAverage(
  usedByDate: UsedByDate,
  endKey: string,
  days = 7,
): number {
  let total = 0;
  let counted = 0;
  for (let i = 0; i < days; i++) {
    const used = usedByDate[addDays(endKey, -i)];
    if (used !== undefined) {
      total += used;
      counted++;
    }
  }
  return counted === 0 ? 0 : total / counted;
}

export type RecomputeResult = {
  plan: PlanDay[];
  k: number;
  /** True when the new curve needs > 15%/day reduction; offer to move the
   * quit date out by 1–2 weeks, but never move it automatically. */
  tooSteep: boolean;
};

/**
 * Rebuild the curve from `fromDate` with a new baseline (typically the
 * trailing 7-day actual average), keeping the quit date fixed.
 */
export function recomputePlan(
  newBaseline: number,
  fromDate: string,
  quitDate: string,
): RecomputeResult {
  const baseline = Math.max(1, newBaseline);
  const taperDays = daysBetween(fromDate, quitDate);
  const plan = buildCurve(baseline, fromDate, quitDate);
  const k = decayK(baseline, taperDays);
  return { plan, k, tooSteep: k > MAX_K };
}
