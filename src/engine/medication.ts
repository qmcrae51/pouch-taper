import { addDays, daysBetween } from "./dates";

export type DoseStep = {
  /** First day (1-based) this dose applies. */
  fromDay: number;
  mg: number;
  timesPerDay: number;
};

export type Medication = {
  enabled: boolean;
  name: string;
  startDate: string; // ISO date, day 1
  totalDays: number;
  steps: DoseStep[];
};

export type DoseToday = {
  dayNumber: number;
  totalDays: number;
  mg: number;
  timesPerDay: number;
  /** Set when tomorrow's dose differs from today's. */
  nextChange?: { mg: number; timesPerDay: number };
  lastDay: boolean;
};

function stepFor(med: Medication, dayNumber: number): DoseStep | undefined {
  let current: DoseStep | undefined;
  for (const step of [...med.steps].sort((a, b) => a.fromDay - b.fromDay)) {
    if (step.fromDay <= dayNumber) current = step;
  }
  return current;
}

/** Today's dose, or null when the course is off, not started, or finished. */
export function doseForDay(med: Medication, dateKey: string): DoseToday | null {
  if (!med.enabled) return null;
  const dayNumber = daysBetween(med.startDate, dateKey) + 1;
  if (dayNumber < 1 || dayNumber > med.totalDays) return null;
  const step = stepFor(med, dayNumber);
  if (!step || step.timesPerDay < 1) return null;

  const lastDay = dayNumber === med.totalDays;
  const tomorrow = lastDay ? undefined : stepFor(med, dayNumber + 1);
  const changes =
    tomorrow &&
    (tomorrow.mg !== step.mg || tomorrow.timesPerDay !== step.timesPerDay);

  return {
    dayNumber,
    totalDays: med.totalDays,
    mg: step.mg,
    timesPerDay: step.timesPerDay,
    nextChange: changes
      ? { mg: tomorrow.mg, timesPerDay: tomorrow.timesPerDay }
      : undefined,
    lastDay,
  };
}

/** Last day of the course, as an ISO date. */
export function courseEndDate(med: Medication): string {
  return addDays(med.startDate, med.totalDays - 1);
}

export function formatDose(mg: number, timesPerDay: number): string {
  const times =
    timesPerDay === 1 ? "once" : timesPerDay === 2 ? "twice" : `${timesPerDay}×`;
  return `${mg} mg ${times}`;
}
