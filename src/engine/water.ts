export const OZ_ML = 29.5735;

export function bottleMl(bottleOz: number): number {
  return bottleOz * OZ_ML;
}

/** Bottles needed to hit the daily goal, rounded up so the goal is covered. */
export function goalBottles(goalLitres: number, bottleOz: number): number {
  return Math.max(1, Math.ceil((goalLitres * 1000) / bottleMl(bottleOz)));
}

export function litresFrom(bottles: number, bottleOz: number): number {
  return (bottles * bottleMl(bottleOz)) / 1000;
}
