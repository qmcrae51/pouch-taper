export type Settings = {
  productName: string;
  mgPerPouch: number;
  pouchesPerTin: number;
  costPerTin: number;
  currency: string;
  baselinePerDay: number;
  startDate: string; // ISO date
  quitDate: string; // ISO date, first zero day
  dayRolloverHour: number;
  wakeTime: string; // "HH:MM"
  sleepTime: string; // "HH:MM"
  delayMinutes: number;
  timezone: string;
  travelMode: { active: boolean; from?: string; to?: string };
  /** Pinned slot times when the daily allowance is 1 or 2. */
  anchors: { one: string[]; two: string[] };
  water: { bottleOz: number; goalLitres: number };
};

export type PlanDay = {
  date: string; // ISO date
  dayIndex: number;
  plannedAllowance: number; // original curve, immutable
  adjustedAllowance: number; // after repayment adjustments
};

export type PouchLog = {
  id: string;
  timestamp: string; // ISO datetime
  dateKey: string; // resolved with rollover hour
  early: boolean;
  craving?: 1 | 2 | 3 | 4 | 5;
  trigger?: string;
  note?: string;
};

export type DelayEvent = {
  id: string;
  timestamp: string;
  outcome: "resisted" | "used";
};

export type WaterLog = {
  id: string;
  timestamp: string; // ISO datetime
  dateKey: string; // resolved with rollover hour
};

/** Pouches actually used per dateKey. Days with no entry are "unknown", not zero. */
export type UsedByDate = Record<string, number>;
