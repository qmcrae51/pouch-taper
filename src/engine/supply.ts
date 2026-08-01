import type { PlanDay } from "./types";

export const SUPPLY_BUFFER = 0.25;

export type SupplyPlan = {
  /** Sum of adjusted allowances in the range, inclusive. */
  pouches: number;
  /** Recommended amount to pack: planned + 25% buffer, rounded up. */
  withBuffer: number;
  tinsPlanned: number;
  tinsWithBuffer: number;
};

export function supplyPlan(
  plan: PlanDay[],
  from: string,
  to: string,
  pouchesPerTin: number,
): SupplyPlan {
  const pouches = plan
    .filter((d) => d.date >= from && d.date <= to)
    .reduce((sum, d) => sum + d.adjustedAllowance, 0);
  const withBuffer = Math.ceil(pouches * (1 + SUPPLY_BUFFER));
  return {
    pouches,
    withBuffer,
    tinsPlanned: Math.ceil(pouches / pouchesPerTin),
    tinsWithBuffer: Math.ceil(withBuffer / pouchesPerTin),
  };
}
