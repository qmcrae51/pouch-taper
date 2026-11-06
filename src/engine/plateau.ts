import { addDays } from "./dates";
import type { PlanDay, UsedByDate } from "./types";

const PLATEAU_STREAK_DAYS = 5;
const PLATEAU_ALLOWANCE_MAX = 2;

/**
 * The plateau banner fires after 5 consecutive completed days at or above
 * allowance while the allowance is 1 or 2. One banner, shown once,
 * non-dismissible for 24h — the display policy lives in the UI; this just
 * says whether the condition holds ending yesterday relative to `todayKey`.
 */
export function plateauBannerDue(
  plan: PlanDay[],
  usedByDate: UsedByDate,
  todayKey: string,
): boolean {
  const byDate = new Map(plan.map((d) => [d.date, d]));
  for (let i = 1; i <= PLATEAU_STREAK_DAYS; i++) {
    const key = addDays(todayKey, -i);
    const day = byDate.get(key);
    const used = usedByDate[key];
    if (!day || day.plannedAllowance === 0 || used === undefined) return false;
    if (day.adjustedAllowance > PLATEAU_ALLOWANCE_MAX) return false;
    if (used < day.adjustedAllowance) return false;
  }
  return true;
}
