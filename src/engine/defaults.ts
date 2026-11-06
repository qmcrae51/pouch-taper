import type { Milestone, Settings } from "./types";

/** Prefill for "Start a new plan": 8/day, halved by end of week 4, zero after week 8. */
export const NEW_PHASE_DEFAULTS: {
  baselinePerDay: number;
  weeks: number;
  milestones: Milestone[];
} = {
  baselinePerDay: 8,
  weeks: 8,
  milestones: [{ dayIndex: 27, fraction: 0.5 }],
};

export const DEFAULT_SETTINGS: Settings = {
  productName: "Zonnic 4mg",
  mgPerPouch: 4,
  pouchesPerTin: 24,
  costPerTin: 18.0,
  currency: "CAD",
  baselinePerDay: 10,
  startDate: "2026-08-01",
  quitDate: "2026-09-11",
  dayRolloverHour: 4,
  wakeTime: "07:00",
  sleepTime: "23:00",
  delayMinutes: 5,
  timezone: "America/Toronto",
  travelMode: { active: false, from: "2026-08-26", to: "2026-09-06" },
  anchors: { one: ["09:00"], two: ["09:00", "17:00"] },
  water: { bottleOz: 24, goalLitres: 4 },
  medication: {
    enabled: true,
    name: "Varenicline",
    startDate: "2026-11-06",
    totalDays: 84,
    steps: [
      { fromDay: 1, mg: 0.5, timesPerDay: 1 },
      { fromDay: 4, mg: 0.5, timesPerDay: 2 },
      { fromDay: 8, mg: 1, timesPerDay: 2 },
    ],
  },
};
