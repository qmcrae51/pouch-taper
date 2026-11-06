import { addDays, daysBetween } from "./dates";
import type { Milestone, PlanDay } from "./types";

export const FLOOR = 1;

/**
 * Exponential decay coefficient for a taper of `taperDays` days starting at
 * `baseline` and ending at FLOOR on the last taper day.
 */
export function decayK(baseline: number, taperDays: number): number {
  if (taperDays <= 1) return Infinity;
  return Math.log(baseline / FLOOR) / (taperDays - 1);
}

function taperDaysBetween(startDate: string, quitDate: string): number {
  const taperDays = daysBetween(startDate, quitDate);
  if (taperDays < 1) {
    throw new Error("quitDate must be after startDate");
  }
  return taperDays;
}

/**
 * Turn raw per-day values into plan days: rounded half-up, clamped to
 * >= FLOOR and to be monotonically non-increasing, followed by the quit date
 * at 0.
 */
function toPlan(
  raw: (t: number) => number,
  startDate: string,
  quitDate: string,
  taperDays: number,
): PlanDay[] {
  const days: PlanDay[] = [];
  let prev = Infinity;
  for (let t = 0; t < taperDays; t++) {
    // Math.round is half-up for positive values.
    let allowance = Math.max(FLOOR, Math.round(raw(t)));
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

/**
 * Build the full plan: taper days from startDate through the day before
 * quitDate (allowance >= 1), plus the quit date itself at 0.
 *
 * raw(t) = B * exp(-k * t)
 */
export function buildCurve(
  baseline: number,
  startDate: string,
  quitDate: string,
): PlanDay[] {
  const taperDays = taperDaysBetween(startDate, quitDate);
  const k = decayK(baseline, taperDays);
  return toPlan(
    (t) => (taperDays === 1 ? FLOOR : baseline * Math.exp(-k * t)),
    startDate,
    quitDate,
    taperDays,
  );
}

/**
 * Piecewise exponential through fixed anchor points: B on day 0, B * fraction
 * on each milestone's day, and FLOOR on the last taper day. Milestones outside
 * the taper window, or not strictly decreasing, are ignored.
 */
export function buildMilestoneCurve(
  baseline: number,
  startDate: string,
  quitDate: string,
  milestones: Milestone[],
): PlanDay[] {
  const taperDays = taperDaysBetween(startDate, quitDate);
  const last = taperDays - 1;
  const anchors: { t: number; v: number }[] = [{ t: 0, v: baseline }];
  for (const m of [...milestones].sort((a, b) => a.dayIndex - b.dayIndex)) {
    const v = baseline * m.fraction;
    const prev = anchors[anchors.length - 1];
    if (m.dayIndex > prev.t && m.dayIndex < last && v < prev.v && v > FLOOR) {
      anchors.push({ t: m.dayIndex, v });
    }
  }
  if (last > 0) anchors.push({ t: last, v: FLOOR });

  return toPlan(
    (t) => {
      let i = 0;
      while (i < anchors.length - 2 && t > anchors[i + 1].t) i++;
      const a = anchors[i];
      const b = anchors[i + 1];
      if (!b) return a.v;
      const progress = (t - a.t) / (b.t - a.t);
      return a.v * Math.pow(b.v / a.v, progress);
    },
    startDate,
    quitDate,
    taperDays,
  );
}

/** The plan for the current settings: milestone curve when milestones are set. */
export function buildPlanFor(s: {
  baselinePerDay: number;
  startDate: string;
  quitDate: string;
  milestones?: Milestone[];
}): PlanDay[] {
  return s.milestones && s.milestones.length > 0
    ? buildMilestoneCurve(s.baselinePerDay, s.startDate, s.quitDate, s.milestones)
    : buildCurve(s.baselinePerDay, s.startDate, s.quitDate);
}
