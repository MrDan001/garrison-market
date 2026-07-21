// lib/plans.ts
// Single source of truth for plan pricing and limits.
// Adjust prices/limits here — nothing else should hardcode these numbers.

export type PlanId = "basic" | "premium";
export type BillingCycleId = "quarterly" | "biannual" | "annual";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceNaira: number; // per month, in Naira
  maxStores: number;
  maxStaff: number;
  maxProducts: number;
  businessSummaryChart: boolean;
  consignment: boolean;
  // Discount applied to (priceNaira x cycle months) for that cycle, 0-100.
  // Premium carries deeper discounts on longer cycles than Basic on purpose
  // — it narrows the price gap between plans as commitment length grows,
  // so a subscriber comparing 12-month plans sees Premium as ~1.4x Basic
  // instead of a flat 2x, nudging them toward the upgrade.
  discounts: Record<BillingCycleId, number>;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceNaira: 6000,
    maxStores: 1,
    maxStaff: 2,
    maxProducts: 10,
    businessSummaryChart: false,
    consignment: false,
    discounts: { quarterly: 0, biannual: 5, annual: 10 },
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceNaira: 12000,
    maxStores: 2,
    maxStaff: 4,
    maxProducts: 30,
    businessSummaryChart: true,
    consignment: true,
    discounts: { quarterly: 0, biannual: 20, annual: 35 },
  },
};

// Billing is upfront, in fixed multi-month blocks — no monthly option.
// months = how many months the cycle covers. Discount % now lives per-plan
// (see PlanConfig.discounts above), not here — Basic and Premium apply
// different discounts to the same cycle on purpose.
export interface BillingCycleConfig {
  id: BillingCycleId;
  label: string;
  months: number;
}

export const BILLING_CYCLES: Record<BillingCycleId, BillingCycleConfig> = {
  quarterly: { id: "quarterly", label: "Quarterly (3 months)", months: 3 },
  biannual: { id: "biannual", label: "Bi-Annual (6 months)", months: 6 },
  annual: { id: "annual", label: "Annual (12 months)", months: 12 },
};

export function getCyclePrice(plan: PlanId, cycle: BillingCycleId): number {
  const { priceNaira: monthly, discounts } = PLANS[plan];
  const { months } = BILLING_CYCLES[cycle];
  const discountPct = discounts[cycle];
  const raw = monthly * months;
  return Math.round(raw * (1 - discountPct / 100));
}

export function getCycleDiscountPct(plan: PlanId, cycle: BillingCycleId): number {
  return PLANS[plan].discounts[cycle];
}

export const TRIAL_DAYS = 14;

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  return PLANS[plan as PlanId] || PLANS.basic;
}