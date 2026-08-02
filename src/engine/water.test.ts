import { describe, expect, it } from "vitest";
import { bottleMl, goalBottles, litresFrom } from "./water";

describe("water goal math", () => {
  it("a 24oz bottle is about 710 mL", () => {
    expect(bottleMl(24)).toBeCloseTo(709.76, 1);
  });

  it("4 litres in 24oz bottles needs 6 bottles", () => {
    expect(goalBottles(4, 24)).toBe(6);
  });

  it("an exact fit doesn't round up", () => {
    // 1L bottle-equivalent: 1000 / 29.5735 oz.
    expect(goalBottles(3, 1000 / 29.5735)).toBe(3);
  });

  it("converts bottles back to litres", () => {
    expect(litresFrom(6, 24)).toBeCloseTo(4.26, 2);
  });

  it("never needs zero bottles", () => {
    expect(goalBottles(0.1, 24)).toBe(1);
  });
});
