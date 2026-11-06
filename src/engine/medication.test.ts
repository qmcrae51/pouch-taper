import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { courseEndDate, doseForDay, formatDose } from "./medication";

const med = DEFAULT_SETTINGS.medication;

describe("varenicline schedule (defaults)", () => {
  it("is off before day 1", () => {
    expect(doseForDay(med, "2026-11-05")).toBeNull();
  });

  it("days 1-3: 0.5 mg once a day", () => {
    expect(doseForDay(med, "2026-11-06")).toMatchObject({
      dayNumber: 1,
      totalDays: 84,
      mg: 0.5,
      timesPerDay: 1,
      nextChange: undefined,
      lastDay: false,
    });
    expect(doseForDay(med, "2026-11-08")).toMatchObject({
      dayNumber: 3,
      mg: 0.5,
      timesPerDay: 1,
      nextChange: { mg: 0.5, timesPerDay: 2 },
    });
  });

  it("days 4-7: 0.5 mg twice a day", () => {
    expect(doseForDay(med, "2026-11-09")).toMatchObject({
      dayNumber: 4,
      mg: 0.5,
      timesPerDay: 2,
      nextChange: undefined,
    });
    expect(doseForDay(med, "2026-11-12")).toMatchObject({
      dayNumber: 7,
      nextChange: { mg: 1, timesPerDay: 2 },
    });
  });

  it("day 8 onward: 1 mg twice a day through Jan 28", () => {
    expect(doseForDay(med, "2026-11-13")).toMatchObject({
      dayNumber: 8,
      mg: 1,
      timesPerDay: 2,
    });
    expect(doseForDay(med, "2027-01-01")).toMatchObject({ mg: 1, timesPerDay: 2 });
    expect(doseForDay(med, "2027-01-28")).toMatchObject({
      dayNumber: 84,
      lastDay: true,
      nextChange: undefined,
    });
    expect(courseEndDate(med)).toBe("2027-01-28");
  });

  it("is off after the course and when disabled", () => {
    expect(doseForDay(med, "2027-01-29")).toBeNull();
    expect(doseForDay({ ...med, enabled: false }, "2026-11-20")).toBeNull();
  });

  it("formats doses", () => {
    expect(formatDose(0.5, 1)).toBe("0.5 mg once");
    expect(formatDose(1, 2)).toBe("1 mg twice");
    expect(formatDose(1, 3)).toBe("1 mg 3×");
  });
});
