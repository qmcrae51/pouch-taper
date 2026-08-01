import { describe, expect, it } from "vitest";
import { buildCurve } from "./curve";
import { DEFAULT_SETTINGS } from "./defaults";
import { plateauBannerDue } from "./plateau";
import { recomputePlan, trailingAverage } from "./recompute";
import { supplyPlan } from "./supply";

const plan = buildCurve(
  DEFAULT_SETTINGS.baselinePerDay,
  DEFAULT_SETTINGS.startDate,
  DEFAULT_SETTINGS.quitDate,
);

describe("supply planner", () => {
  it("Aug 26 - Sep 6 needs 20 pouches, pack 25 with the buffer", () => {
    const s = supplyPlan(plan, "2026-08-26", "2026-09-06", 24);
    expect(s.pouches).toBe(20);
    expect(s.withBuffer).toBe(25);
    expect(s.tinsPlanned).toBe(1);
  });

  it("includes the quit day as zero without breaking", () => {
    const s = supplyPlan(plan, "2026-09-08", "2026-09-11", 24);
    expect(s.pouches).toBe(3); // 1 + 1 + 1 + 0
  });
});

describe("recompute plan", () => {
  it("uses the trailing 7-day average, ignoring unlogged days", () => {
    const used = {
      "2026-08-10": 8,
      "2026-08-09": 6,
      "2026-08-07": 7,
    };
    expect(trailingAverage(used, "2026-08-10")).toBe(7);
  });

  it("keeps the quit date fixed and is not steep with a comfortable runway", () => {
    const { plan: p, tooSteep } = recomputePlan(7, "2026-08-10", "2026-09-11");
    expect(p.at(-1)).toMatchObject({ date: "2026-09-11", plannedAllowance: 0 });
    expect(tooSteep).toBe(false);
  });

  it("flags a curve steeper than 15%/day", () => {
    // 12/day with 8 days of runway: k = ln(12)/7 ~ 0.355 > 0.1625.
    const { tooSteep } = recomputePlan(12, "2026-09-03", "2026-09-11");
    expect(tooSteep).toBe(true);
  });
});

describe("plateau guard", () => {
  it("fires after 5 consecutive at-or-above days while allowance <= 2", () => {
    // Aug 26-30 all have allowance 2; log exactly 2 each day.
    const used = {
      "2026-08-26": 2,
      "2026-08-27": 2,
      "2026-08-28": 2,
      "2026-08-29": 2,
      "2026-08-30": 2,
    };
    expect(plateauBannerDue(plan, used, "2026-08-31")).toBe(true);
  });

  it("does not fire when any day is under allowance", () => {
    const used = {
      "2026-08-26": 2,
      "2026-08-27": 2,
      "2026-08-28": 1,
      "2026-08-29": 2,
      "2026-08-30": 2,
    };
    expect(plateauBannerDue(plan, used, "2026-08-31")).toBe(false);
  });

  it("does not fire while allowance is above 2", () => {
    const used = {
      "2026-08-15": 4,
      "2026-08-16": 4,
      "2026-08-17": 4,
      "2026-08-18": 4,
      "2026-08-19": 4,
    };
    expect(plateauBannerDue(plan, used, "2026-08-20")).toBe(false);
  });

  it("does not fire when a day in the streak has no logs", () => {
    const used = {
      "2026-08-26": 2,
      "2026-08-27": 2,
      "2026-08-29": 2,
      "2026-08-30": 2,
    };
    expect(plateauBannerDue(plan, used, "2026-08-31")).toBe(false);
  });
});
