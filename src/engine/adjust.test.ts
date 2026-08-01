import { describe, expect, it } from "vitest";
import { computeAdjustedPlan, shouldOfferRecompute } from "./adjust";
import { buildCurve } from "./curve";
import { DEFAULT_SETTINGS } from "./defaults";

const plan = buildCurve(
  DEFAULT_SETTINGS.baselinePerDay,
  DEFAULT_SETTINGS.startDate,
  DEFAULT_SETTINGS.quitDate,
);

describe("overuse repayment", () => {
  it("over by 2 on allowance 10 repays 1/day until repaid (2 days), never below 1", () => {
    // Aug 1 allowance 10; Aug 2-4 planned 9, 9, 8.
    const adjusted = computeAdjustedPlan(plan, { "2026-08-01": 12 });
    expect(adjusted[1].adjustedAllowance).toBe(8); // 9 - 1
    expect(adjusted[2].adjustedAllowance).toBe(8); // 9 - 1, excess repaid
    expect(adjusted[3].adjustedAllowance).toBe(8); // untouched
    for (const d of adjusted.slice(0, -1)) {
      expect(d.adjustedAllowance).toBeGreaterThanOrEqual(1);
    }
  });

  it("over by 3 reduces the next 3 days by 1 each", () => {
    const adjusted = computeAdjustedPlan(plan, { "2026-08-01": 13 });
    expect(adjusted[1].adjustedAllowance).toBe(8);
    expect(adjusted[2].adjustedAllowance).toBe(8);
    expect(adjusted[3].adjustedAllowance).toBe(7);
    expect(adjusted[4].adjustedAllowance).toBe(8); // outside the window
  });

  it("over by 10 repays only what the 3-day/1-per-day cap allows and absorbs the rest", () => {
    const adjusted = computeAdjustedPlan(plan, { "2026-08-01": 20 });
    expect(adjusted[1].adjustedAllowance).toBe(8);
    expect(adjusted[2].adjustedAllowance).toBe(8);
    expect(adjusted[3].adjustedAllowance).toBe(7);
    // The remaining 7 are absorbed; nothing else changes, nothing negative.
    for (let i = 4; i < adjusted.length; i++) {
      expect(adjusted[i].adjustedAllowance).toBe(plan[i].plannedAllowance);
    }
    for (const d of adjusted.slice(0, -1)) {
      expect(d.adjustedAllowance).toBeGreaterThanOrEqual(1);
    }
  });

  it("never reduces a day below 1, even deep in the tail", () => {
    // Sep 2 (allowance 2) massively over; Sep 3-5 are all at 1 already.
    const adjusted = computeAdjustedPlan(plan, { "2026-09-02": 10 });
    expect(adjusted[33].adjustedAllowance).toBe(1);
    expect(adjusted[34].adjustedAllowance).toBe(1);
    expect(adjusted[35].adjustedAllowance).toBe(1);
  });

  it("never touches the quit day", () => {
    const adjusted = computeAdjustedPlan(plan, { "2026-09-10": 6 });
    expect(adjusted.at(-1)!.adjustedAllowance).toBe(0);
  });

  it("excess is measured against the adjusted allowance, so overuse compounds", () => {
    // Aug 2 adjusted down to 8 by Aug 1's overuse; using 9 on Aug 2 is over by 1.
    const adjusted = computeAdjustedPlan(plan, {
      "2026-08-01": 12,
      "2026-08-02": 9,
    });
    expect(adjusted[1].adjustedAllowance).toBe(8); // from Aug 1 repayment
    expect(adjusted[2].adjustedAllowance).toBe(7); // 9 - 1 (Aug 1) - 1 (Aug 2)
  });
});

describe("underuse", () => {
  it("never increases a later day's allowance", () => {
    const adjusted = computeAdjustedPlan(plan, {
      "2026-08-01": 4,
      "2026-08-02": 3,
      "2026-08-03": 2,
    });
    for (let i = 0; i < adjusted.length; i++) {
      expect(adjusted[i].adjustedAllowance).toBeLessThanOrEqual(
        plan[i].plannedAllowance,
      );
      expect(adjusted[i].adjustedAllowance).toBe(plan[i].plannedAllowance);
    }
  });

  it("offers recompute after 3 consecutive days >= 25% under", () => {
    // Aug 2-4 allowances 9, 9, 8; 75% thresholds 6.75, 6.75, 6.
    const used = { "2026-08-02": 6, "2026-08-03": 6, "2026-08-04": 6 };
    expect(shouldOfferRecompute(plan, used, "2026-08-05")).toBe(true);
  });

  it("does not offer recompute when a day misses the 25% margin", () => {
    const used = { "2026-08-02": 6, "2026-08-03": 7, "2026-08-04": 6 };
    expect(shouldOfferRecompute(plan, used, "2026-08-05")).toBe(false);
  });

  it("does not offer recompute when a day has no logs", () => {
    const used = { "2026-08-02": 6, "2026-08-04": 6 };
    expect(shouldOfferRecompute(plan, used, "2026-08-05")).toBe(false);
  });

  it("never fires when today's allowance is 1 or 2", () => {
    // Aug 27 allowance 2; three prior days logged at 0, maximally under.
    const used = { "2026-08-24": 0, "2026-08-25": 0, "2026-08-26": 0 };
    expect(shouldOfferRecompute(plan, used, "2026-08-27")).toBe(false);
    // Sep 5 allowance 1.
    const used2 = { "2026-09-02": 0, "2026-09-03": 0, "2026-09-04": 0 };
    expect(shouldOfferRecompute(plan, used2, "2026-09-05")).toBe(false);
  });
});
