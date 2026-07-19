// lib/plans.ts
// Single source of truth for plan pricing and limits.
// Adjust prices/limits here — nothing else should hardcode these numbers.

export type PlanId = "basic" | "premium";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceNaira: number; // per month, in Naira
  maxStores: number;
  maxStaff: number;
  maxProducts: number;
  businessSummaryChart: boolean;
  consignment: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceNaira: 8000,
    maxStores: 1,
    maxStaff: 2,
    maxProducts: 10,
    businessSummaryChart: false,
    consignment: false,
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceNaira: 15000,
    maxStores: 2,
    maxStaff: 4,
    maxProducts: 30,
    businessSummaryChart: true,
    consignment: true,
  },
};

// Billing is upfront, in fixed multi-month blocks — no monthly option.
// months = how many months the cycle covers. discountPct is applied to the
// straight monthly-rate x months total, as an incentive for longer commitment.
export type BillingCycleId = "quarterly" | "biannual" | "annual";

export interface BillingCycleConfig {
  id: BillingCycleId;
  label: string;
  months: number;
  discountPct: number; // 0-100
}

export const BILLING_CYCLES: Record<BillingCycleId, BillingCycleConfig> = {
  quarterly: { id: "quarterly", label: "Quarterly (3 months)", months: 3, discountPct: 0 },
  biannual: { id: "biannual", label: "Bi-Annual (6 months)", months: 6, discountPct: 5 },
  annual: { id: "annual", label: "Annual (12 months)", months: 12, discountPct: 10 },
};

export function getCyclePrice(plan: PlanId, cycle: BillingCycleId): number {
  const monthly = PLANS[plan].priceNaira;
  const { months, discountPct } = BILLING_CYCLES[cycle];
  const raw = monthly * months;
  return Math.round(raw * (1 - discountPct / 100));
}

export const TRIAL_DAYS = 14;

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  return PLANS[plan as PlanId] || PLANS.basic;
}
