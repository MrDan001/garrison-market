// Pure unit-conversion helpers for Scale (weight/volume) inventory.
// Deliberately NOT a "use server" file — Next.js only allows "use server"
// files to export async functions, but these are synchronous and need to
// run client-side too (e.g. live preview while staff type a sale amount).

export const BASE_UNITS = ["kg", "L"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const SUB_UNIT_OF: Record<BaseUnit, string> = { kg: "g", L: "ml" };
const CONVERSION_FACTOR: Record<BaseUnit, number> = { kg: 1000, L: 1000 }; // 1kg = 1000g, 1L = 1000ml

export function unitsForBase(base: string): { base: string; sub: string } | null {
  if (base !== "kg" && base !== "L") return null;
  return { base, sub: SUB_UNIT_OF[base] };
}

// Converts an entered amount (in `enteredUnit`) into the product's base unit.
// Throws if enteredUnit doesn't belong to that base unit's pair.
export function convertToBaseUnit(amount: number, enteredUnit: string, baseUnit: string): number {
  if (enteredUnit === baseUnit) return amount;
  const pair = unitsForBase(baseUnit);
  if (!pair || enteredUnit !== pair.sub) {
    throw new Error(`Invalid unit "${enteredUnit}" for a product stocked in "${baseUnit}".`);
  }
  return amount / CONVERSION_FACTOR[baseUnit as BaseUnit];
}

// Reverse direction: given a naira amount the customer wants to spend, work
// out how much of the product (in `wantUnit`) that buys, so staff can weigh
// out that much. `pricePerBaseUnit` is always price-per-kg or price-per-L
// (how ScaleInventory.price is stored); if wantUnit is the sub-unit (g/ml),
// the per-unit price is scaled down accordingly first.
// Rounded to a scale-realistic precision — 3dp for the base unit (kg/L),
// whole units for the sub-unit (g/ml), since fractional grams/ml aren't
// something a staff member can actually measure out.
export function quantityFromAmount(nairaAmount: number, pricePerBaseUnit: number, wantUnit: string, baseUnit: string): number {
  if (!(nairaAmount > 0) || !(pricePerBaseUnit > 0)) return 0;
  const pair = unitsForBase(baseUnit);
  const isSubUnit = !!pair && wantUnit === pair.sub;
  const pricePerWantUnit = isSubUnit ? pricePerBaseUnit / CONVERSION_FACTOR[baseUnit as BaseUnit] : pricePerBaseUnit;
  const raw = nairaAmount / pricePerWantUnit;
  return isSubUnit ? Math.round(raw) : Math.round(raw * 1000) / 1000;
}