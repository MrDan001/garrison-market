// lib/plans.ts
// Single source of truth for plan pricing and limits.
// Adjust prices/limits here — nothing else should hardcode these numbers.

export type PlanId = "basic" | "premium" | "max";
export type BillingCycleId = "quarterly" | "biannual" | "annual";

export interface PlanConfig {
  id: PlanId;
  name: string;
  // NOTE: there is no static/default priceNaira anymore. Pricing is fully
  // negotiated per owner — see customPriceBasicNaira / customPricePremiumNaira
  // on the User model, set by an admin via setCustomPriceAction. Until an
  // admin sets a rate for a given owner+plan, that plan has no price and
  // cannot be checked out.
  maxStores: number;
  maxStaff: number;
  maxProducts: number;
  businessSummaryChart: boolean;
  // Staff can sign consignment stock out to customers (Standard) and sell
  // against scale stock signed out to them. Was just "consignment" before
  // this was split in two — renamed so it reads as what it actually gates.
  staffConsignment: boolean;
  // Owner personally signs stock out (Standard, direct-to-customer) and
  // signs scale stock out to staff/all-staff. New — previously ungated on
  // every plan via signOutConsignment/signOutScaleConsignment having no
  // plan check at all, only the owner's own consignmentEnabled toggle.
  ownerConsignment: boolean;
  // Debtors / part-payments. New — previously ungated on every plan.
  debtors: boolean;
  // Customer profiles ranked by spend. New — previously ungated on every plan.
  customerProfiles: boolean;
  // Discount applied to (negotiated monthly rate x cycle months) for that cycle, 0-100.
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
    maxStores: 1,
    maxStaff: 2,
    maxProducts: 10,
    businessSummaryChart: false,
    staffConsignment: false,
    ownerConsignment: false,
    debtors: false,
    customerProfiles: false,
    discounts: { quarterly: 0, biannual: 5, annual: 10 },
  },
  premium: {
    id: "premium",
    // Display name only — the internal id stays "premium" everywhere
    // (Payment.plan, User relations, PlanId type, etc. all already store
    // this string in the database, so changing the id itself would be a
    // real data migration). This is purely what renders on screen.
    name: "Pro",
    maxStores: 2,
    maxStaff: 4,
    maxProducts: 30,
    businessSummaryChart: true,
    staffConsignment: true,
    ownerConsignment: false,
    debtors: true,
    customerProfiles: true,
    discounts: { quarterly: 0, biannual: 20, annual: 35 },
  },
  // Max Package: no self-service price — an owner requests it via Support
  // or email, an admin negotiates and sets a rate with setCustomPriceAction
  // (customPriceMaxNaira on the User model), and only then can they check
  // out for it, same flow as Basic/Premium. Infinity is a legitimate number
  // in JS/TS here: every limit check in subscription-guard.ts is
  // `count >= limit`, so Infinity simply never trips.
  //
  // NOTE: PLANS.max's limits below are what a Max *checkout* grants once
  // paid. The actual on/off unlock for a given owner is the separate
  // maxPackageEnabled flag (set automatically on successful Max payment,
  // or manually by an admin) — see resolveEffectivePlanId() in
  // lib/subscription-guard.ts.
  max: {
    id: "max",
    name: "Max Package",
    maxStores: Infinity,
    maxStaff: Infinity,
    maxProducts: Infinity,
    businessSummaryChart: true,
    staffConsignment: true,
    ownerConsignment: true,
    debtors: true,
    customerProfiles: true,
    discounts: { quarterly: 0, biannual: 25, annual: 40 },
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

/**
 * Returns the price for a plan+cycle, or null if this owner has no
 * negotiated rate for that plan yet. There is no static fallback price —
 * an admin must set a rate (via setCustomPriceAction) before an owner can
 * see a price or check out for that plan.
 */
export function getCyclePrice(plan: PlanId, cycle: BillingCycleId, customMonthlyNaira?: number | null): number | null {
  if (!customMonthlyNaira || customMonthlyNaira <= 0) return null;
  const { discounts } = PLANS[plan];
  const { months } = BILLING_CYCLES[cycle];
  const discountPct = discounts[cycle];
  const raw = customMonthlyNaira * months;
  return Math.round(raw * (1 - discountPct / 100));
}

export function getCycleDiscountPct(plan: PlanId, cycle: BillingCycleId): number {
  return PLANS[plan].discounts[cycle];
}

export const TRIAL_DAYS = 14;

export function getPlanConfig(plan: string | null | undefined): PlanConfig {
  return PLANS[plan as PlanId] || PLANS.basic;
}