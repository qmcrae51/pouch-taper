import { describe, expect, it } from "vitest";
import { buildCurve, decayK } from "./curve";
import { DEFAULT_SETTINGS } from "./defaults";

const { baselinePerDay, startDate, quitDate } = DEFAULT_SETTINGS;

// The exact 41-day allowance table from the spec, t = 0 (Aug 1) .. 40 (Sep 10).
const EXPECTED = [
  10, 9, 9, 8, 8, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3,
  2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
];

describe("planned curve (defaults: B=10, Aug 1 -> Sep 11)", () => {
  const plan = buildCurve(baselinePerDay, startDate, quitDate);
  const taperDays = plan.slice(0, -1);

  it("k matches the spec", () => {
    expect(decayK(10, 41)).toBeCloseTo(0.05756, 4);
  });

  it("produces exactly the 41-day allowance table", () => {
    expect(taperDays.map((d) => d.plannedAllowance)).toEqual(EXPECTED);
  });

  it("maps day indices to the right dates", () => {
    expect(taperDays[0]).toMatchObject({ date: "2026-08-01", dayIndex: 0 });
    expect(taperDays[24]).toMatchObject({ date: "2026-08-25", plannedAllowance: 3 });
    expect(taperDays[25]).toMatchObject({ date: "2026-08-26", plannedAllowance: 2 });
    expect(taperDays[40]).toMatchObject({ date: "2026-09-10", dayIndex: 40 });
  });

  it("sums to 160 pouches over the taper", () => {
    const total = taperDays.reduce((s, d) => s + d.plannedAllowance, 0);
    expect(total).toBe(160);
  });

  it("is 0 on the quit date and 1 the day before", () => {
    expect(plan.at(-1)).toMatchObject({ date: "2026-09-11", plannedAllowance: 0 });
    expect(plan.at(-2)).toMatchObject({ date: "2026-09-10", plannedAllowance: 1 });
  });

  it("is monotonically non-increasing at every step", () => {
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].plannedAllowance).toBeLessThanOrEqual(
        plan[i - 1].plannedAllowance,
      );
    }
  });
});

describe("curve robustness across other inputs", () => {
  it.each([
    [15, "2026-08-01", "2026-08-31"],
    [8, "2026-08-01", "2026-09-11"],
    [25, "2026-08-01", "2026-10-01"],
    [3, "2026-08-01", "2026-08-15"],
  ])("B=%i from %s to %s: monotone, floor 1, ends at 0", (b, start, quit) => {
    const plan = buildCurve(b, start, quit);
    expect(plan[0].plannedAllowance).toBe(b);
    expect(plan.at(-1)!.plannedAllowance).toBe(0);
    expect(plan.at(-2)!.plannedAllowance).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].plannedAllowance).toBeLessThanOrEqual(
        plan[i - 1].plannedAllowance,
      );
      if (i < plan.length - 1) {
        expect(plan[i].plannedAllowance).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("rejects a quit date on or before the start date", () => {
    expect(() => buildCurve(10, "2026-08-01", "2026-08-01")).toThrow();
    expect(() => buildCurve(10, "2026-08-01", "2026-07-01")).toThrow();
  });
});
