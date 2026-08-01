import { addDays } from "./dates";
import type { PlanDay, UsedByDate } from "./types";

const REPAY_WINDOW_DAYS = 3;
const REPAY_MAX_PER_DAY = 1;
const UNDER_TARGET_RATIO = 0.75;
const UNDER_STREAK_DAYS = 3;

/**
 * Recompute every day's adjustedAllowance from the immutable planned curve
 * plus actual usage. Recomputing from scratch (rather than mutating on each
 * log) makes backfilled days and edits deterministic.
 *
 * Overuse on a day is repaid across the next 3 taper days, at most 1 pouch
 * per day, never below FLOOR (1), never touching the quit day. Unrepayable
 * excess is absorbed. Underuse never raises a later day's allowance.
 */
export function computeAdjustedPlan(
  plan: PlanDay[],
  usedByDate: UsedByDate,
): PlanDay[] {
  const out = plan.map((d) => ({ ...d, adjustedAllowance: d.plannedAllowance }));
  for (let i = 0; i < out.length; i++) {
    const day = out[i];
    if (day.plannedAllowance === 0) break; // quit day and beyond
    const used = usedByDate[day.date];
    if (used === undefined) continue;
    let excess = used - day.adjustedAllowance;
    for (
      let j = i + 1;
      excess > 0 && j <= i + REPAY_WINDOW_DAYS && j < out.length;
      j++
    ) {
      const next = out[j];
      if (next.plannedAllowance === 0) break;
      if (next.adjustedAllowance > 1) {
        next.adjustedAllowance -= REPAY_MAX_PER_DAY;
        excess -= REPAY_MAX_PER_DAY;
      }
    }
  }
  return out;
}

/**
 * Offer the faster-curve / earlier-quit-date prompt only after 3 consecutive
 * completed days at least 25% under allowance, and never when today's
 * allowance is 1 or 2 (the percentage is noise there). Days with no logs
 * count as unknown and break the streak.
 */
export function shouldOfferRecompute(
  plan: PlanDay[],
  usedByDate: UsedByDate,
  todayKey: string,
): boolean {
  const byDate = new Map(plan.map((d) => [d.date, d]));
  const today = byDate.get(todayKey);
  if (!today || today.adjustedAllowance <= 2) return false;
  for (let i = 1; i <= UNDER_STREAK_DAYS; i++) {
    const key = addDays(todayKey, -i);
    const day = byDate.get(key);
    const used = usedByDate[key];
    if (!day || day.plannedAllowance === 0 || used === undefined) return false;
    if (used > day.adjustedAllowance * UNDER_TARGET_RATIO) return false;
  }
  return true;
}
