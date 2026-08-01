import { describe, expect, it } from "vitest";
import { dateKeyFor, formatHM } from "./dates";
import { buildDaySchedule, isEarly, nextAllowedMinute } from "./schedule";

describe("day boundary (rollover hour 4)", () => {
  it("assigns a 01:30 Aug 5 pouch to Aug 4", () => {
    const ts = new Date(2026, 7, 5, 1, 30); // local time
    expect(dateKeyFor(ts, 4)).toBe("2026-08-04");
  });

  it("assigns a 04:00 pouch to the same calendar day", () => {
    expect(dateKeyFor(new Date(2026, 7, 5, 4, 0), 4)).toBe("2026-08-05");
    expect(dateKeyFor(new Date(2026, 7, 5, 3, 59), 4)).toBe("2026-08-04");
  });

  it("uses plain midnight when rollover hour is 0", () => {
    expect(dateKeyFor(new Date(2026, 7, 5, 0, 30), 0)).toBe("2026-08-05");
  });
});

describe("intra-day slots", () => {
  it("allowance 4 in a 07:00-23:00 window gives 07:00, 11:00, 15:00, 19:00", () => {
    const sched = buildDaySchedule(4, "07:00", "23:00");
    expect(sched.slots.map(formatHM)).toEqual([
      "07:00",
      "11:00",
      "15:00",
      "19:00",
    ]);
    expect(sched.intervalMin).toBe(240);
  });

  it("uses pinned anchors for allowance 2 and 1", () => {
    const two = buildDaySchedule(2, "07:00", "23:00", ["09:00", "17:00"]);
    expect(two.slots.map(formatHM)).toEqual(["09:00", "17:00"]);
    const one = buildDaySchedule(1, "07:00", "23:00", ["09:00"]);
    expect(one.slots.map(formatHM)).toEqual(["09:00"]);
  });

  it("next allowed is max(next unused slot, last log + interval)", () => {
    const sched = buildDaySchedule(4, "07:00", "23:00");
    // No logs yet: first slot.
    expect(nextAllowedMinute(sched, [], 4, false)).toBe(7 * 60);
    // Logged at 07:00: next slot 11:00 vs 07:00+4h -> 11:00.
    expect(nextAllowedMinute(sched, [420], 4, false)).toBe(660);
    // Logged late at 12:30: next slot 15:00 vs 12:30+4h=16:30 -> 16:30.
    expect(nextAllowedMinute(sched, [420, 750], 4, false)).toBe(990);
  });

  it("an early log shifts the remaining slots later, preserving the total", () => {
    const sched = buildDaySchedule(4, "07:00", "23:00");
    // Second pouch taken early at 09:00 (slot was 11:00).
    const next = nextAllowedMinute(sched, [420, 540], 4, false);
    // Next slot 15:00 beats 09:00+4h=13:00; total for the day is still 4.
    expect(next).toBe(900);
    expect(nextAllowedMinute(sched, [420, 540, 900, 1140], 4, false)).toBeNull();
  });

  it("flags early logs", () => {
    expect(isEarly(600, 660, false)).toBe(true);
    expect(isEarly(660, 660, false)).toBe(false);
  });
});

describe("Travel Mode", () => {
  const sched = buildDaySchedule(2, "07:00", "23:00", ["09:00", "17:00"]);

  it("suspends the interval gate and the early flag", () => {
    // 06:00, way before the 09:00 anchor: still allowed, not early.
    const next = nextAllowedMinute(sched, [], 2, true);
    expect(next).toBe(0);
    expect(isEarly(360, next, true)).toBe(false);
  });

  it("still enforces the daily cap", () => {
    expect(nextAllowedMinute(sched, [360, 400], 2, true)).toBeNull();
  });
});
