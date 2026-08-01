import { computeAdjustedPlan } from "../engine/adjust";
import { addDays, dateKeyFor, daysBetween } from "../engine/dates";
import { recomputePlan, trailingAverage } from "../engine/recompute";
import type { PlanDay, PouchLog, UsedByDate } from "../engine/types";
import type { AppState } from "./model";

export function usedByDateFrom(
  logs: PouchLog[],
  backfilled: Record<string, number>,
): UsedByDate {
  const used: UsedByDate = {};
  for (const log of logs) used[log.dateKey] = (used[log.dateKey] ?? 0) + 1;
  // Backfill answers "did you use any on [date]?" for days with no logs.
  for (const [date, n] of Object.entries(backfilled)) {
    if (used[date] === undefined) used[date] = n;
  }
  return used;
}

export function adjustedPlanFor(state: AppState): PlanDay[] {
  return computeAdjustedPlan(
    state.plan,
    usedByDateFrom(state.logs, state.meta.backfilled),
  );
}

/** Past taper days with no logs and no backfill answer, oldest first. */
export function missingDays(state: AppState, todayKey: string): string[] {
  const used = usedByDateFrom(state.logs, state.meta.backfilled);
  const skipped = new Set(state.meta.backfillSkipped);
  return state.plan
    .filter(
      (d) =>
        d.date < todayKey &&
        d.date >= state.settings.startDate &&
        d.plannedAllowance > 0 &&
        used[d.date] === undefined &&
        !skipped.has(d.date),
    )
    .map((d) => d.date);
}

/** Consecutive completed days at or under allowance, ending yesterday. */
export function streakAtOrUnder(state: AppState, todayKey: string): number {
  const adjusted = adjustedPlanFor(state);
  const used = usedByDateFrom(state.logs, state.meta.backfilled);
  const byDate = new Map(adjusted.map((d) => [d.date, d]));
  let streak = 0;
  for (let i = 1; ; i++) {
    const key = addDays(todayKey, -i);
    const day = byDate.get(key);
    if (!day || day.plannedAllowance === 0) break;
    const u = used[key];
    if (u === undefined || u > day.adjustedAllowance) break;
    streak++;
    if (key === state.settings.startDate) break;
  }
  return streak;
}

export type Stats = {
  avoided: number;
  moneySaved: number;
  mgAvoided: number;
  tinsAvoided: number;
  triggers: [string, number][];
  delayResisted: number;
  delayTotal: number;
};

export function statsFor(state: AppState, todayKey: string): Stats {
  const s = state.settings;
  const used = usedByDateFrom(state.logs, state.meta.backfilled);

  const slipByDay: Record<string, number> = {};
  for (const slip of state.slips) {
    const key = dateKeyFor(new Date(slip.timestamp), s.dayRolloverHour);
    slipByDay[key] = (slipByDay[key] ?? 0) + 1;
  }

  // Days with known usage count toward savings; unknown days count as nothing
  // rather than assuming zero use.
  let avoided = 0;
  for (const [date, u] of Object.entries(used)) {
    if (date > todayKey || date >= s.quitDate) continue;
    avoided += s.baselinePerDay - u;
  }
  if (todayKey >= s.quitDate) {
    for (let key = s.quitDate; key <= todayKey; key = addDays(key, 1)) {
      avoided += s.baselinePerDay - (slipByDay[key] ?? 0);
    }
  }

  const costPerPouch = s.costPerTin / s.pouchesPerTin;
  const tally = new Map<string, number>();
  for (const log of state.logs) {
    if (log.trigger) tally.set(log.trigger, (tally.get(log.trigger) ?? 0) + 1);
  }
  const triggers = [...tally.entries()].sort((a, b) => b[1] - a[1]);

  const delayResisted = state.delays.filter((d) => d.outcome === "resisted").length;

  return {
    avoided,
    moneySaved: avoided * costPerPouch,
    mgAvoided: avoided * s.mgPerPouch,
    tinsAvoided: avoided / s.pouchesPerTin,
    triggers,
    delayResisted,
    delayTotal: state.delays.length,
  };
}

export type PostQuitSummary = {
  daysSinceQuit: number;
  daysClean: number;
  totalSlips: number;
};

export function postQuitSummary(state: AppState, todayKey: string): PostQuitSummary {
  const s = state.settings;
  const daysSinceQuit = daysBetween(s.quitDate, todayKey) + 1;
  const slipDays = new Set(
    state.slips.map((slip) =>
      dateKeyFor(new Date(slip.timestamp), s.dayRolloverHour),
    ),
  ).size;
  return {
    daysSinceQuit,
    daysClean: daysSinceQuit - slipDays,
    totalSlips: state.slips.length,
  };
}

export type RecomputePreview = {
  newBaseline: number;
  k: number;
  tooSteep: boolean;
  dailyRatePct: number;
  taperDays: number;
};

function recomputeFrom(state: AppState, todayKey: string): string {
  return todayKey > state.settings.startDate ? todayKey : state.settings.startDate;
}

export function previewRecompute(
  state: AppState,
  todayKey: string,
  quitDate = state.settings.quitDate,
): RecomputePreview | null {
  const from = recomputeFrom(state, todayKey);
  const taperDays = daysBetween(from, quitDate);
  if (taperDays < 1) return null;
  const used = usedByDateFrom(state.logs, state.meta.backfilled);
  const avg = trailingAverage(used, addDays(todayKey, -1), 7);
  const newBaseline = Math.max(1, avg || state.settings.baselinePerDay);
  const { k, tooSteep } = recomputePlan(newBaseline, from, quitDate);
  return {
    newBaseline,
    k,
    tooSteep,
    dailyRatePct: (1 - Math.exp(-k)) * 100,
    taperDays,
  };
}

/**
 * Rebuild the curve from today with the trailing 7-day average as the new
 * baseline. Past plan days are kept so history stays intact; day indices
 * remain relative to the original start date. Returns null when there is no
 * runway left before `quitDate`.
 */
export function applyRecompute(
  state: AppState,
  todayKey: string,
  quitDate = state.settings.quitDate,
): AppState | null {
  const preview = previewRecompute(state, todayKey, quitDate);
  if (!preview) return null;
  const from = recomputeFrom(state, todayKey);
  const { plan: newDays } = recomputePlan(preview.newBaseline, from, quitDate);
  const history = state.plan.filter((d) => d.date < from);
  const plan = [...history, ...newDays].map((d) => ({
    ...d,
    dayIndex: daysBetween(state.settings.startDate, d.date),
  }));
  return {
    ...state,
    settings: { ...state.settings, quitDate },
    plan,
  };
}
