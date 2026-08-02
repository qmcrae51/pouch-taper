import type { Settings } from "./types";

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
};
