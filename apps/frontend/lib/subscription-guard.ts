// lib/subscription-guard.ts
// Single source of truth for "is this owner allowed to do X right now".
// Both owner and staff actions should route through this — staff inherit
// their owner's subscription status.

import prisma from "@/lib/prisma";
import { getPlanConfig, type PlanId } from "@/lib/plans";
import { cache } from "react";
import { LIMIT_REACHED_PREFIX, formatLimitReachedMessage } from "@/lib/limit-message";

export { LIMIT_REACHED_PREFIX, formatLimitReachedMessage };

/**
 * The plan to use for feature/limit checks is NOT always the same as the
 * plan stored on the account.
 *
 * Highest priority: maxPackageEnabled. This is a separate flag from
 * `plan` (see base.prisma) — it flips on automatically the moment a Max
 * Package payment succeeds, or manually via admin override, and while true
 * it always resolves to "max" (unlimited everything), regardless of trial
 * state or what `plan` says. This check comes before the trial check
 * below on purpose: an owner who has actually paid for Max shouldn't lose
 * that the day their original trial would have expired.
 *
 * Otherwise: while an owner is on an active (non-expired) trial, they get
 * full Premium access regardless of what `plan` says — trial means
 * "everything unlocked", so a new signup isn't quietly capped at Basic
 * limits before they've even had a chance to pick a plan. Once the trial
 * ends, this collapses back to whatever they've actually paid for
 * (defaulting to Basic if nothing was purchased).
 */
export function resolveEffectivePlanId(account: {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  maxPackageEnabled?: boolean | null;
}): PlanId {
  if (account.maxPackageEnabled) return "max";

  const isActiveTrial =
    account.subscriptionStatus === "trialing" &&
    !!account.trialEndsAt &&
    account.trialEndsAt > new Date();

  if (isActiveTrial) return "premium";
  return (account.plan as PlanId) || "basic";
}

export interface BillingStatus {
  plan: PlanId;
  subscriptionStatus: string; // "trialing" | "active" | "expired" | "cancelled"
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  isLocked: boolean; // true = mutations should be blocked
  trialDaysLeft: number | null; // null if not trialing
}

/**
 * Computes the live billing status for an owner or inherited staff member.
 *
 * cache()-wrapped: this is called once by app/owner/layout.tsx (for the
 * trial bar) and again by the page it wraps (dashboard, etc). Without this,
 * every owner page load runs this whole resolution — including its DB
 * reads and self-healing write below — twice. cache() collapses repeat
 * calls with the same idParam into one, scoped to a single request.
 */
export const getBillingStatus = cache(async function getBillingStatus(idParam: number): Promise<BillingStatus> {
  if (!idParam) {
    return {
      plan: "basic",
      subscriptionStatus: "expired",
      trialEndsAt: null,
      currentPeriodEnd: null,
      isLocked: true,
      trialDaysLeft: null,
    };
  }

  // 1. Resolve Role Context: Check if the ID provided belongs to a staff member
  let account = await prisma.user.findUnique({
    where: { id: idParam },
    select: {
      id: true,
      role: true,
      ownerId: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      maxPackageEnabled: true,
    },
  });

  // If it's a staff member, jump straight to their parent owner account context
  if (account && account.role === "staff" && account.ownerId) {
    account = await prisma.user.findUnique({
      where: { id: account.ownerId },
      select: {
        id: true,
        role: true,
        ownerId: true,
        plan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        maxPackageEnabled: true,
      },
    });
  }

  if (!account) {
    return {
      plan: "basic",
      subscriptionStatus: "expired",
      trialEndsAt: null,
      currentPeriodEnd: null,
      isLocked: true,
      trialDaysLeft: null,
    };
  }

  const resolvedOwnerId = account.id;
  let currentStatus = account.subscriptionStatus || "trialing";
  let currentPeriodEnd = account.currentPeriodEnd;
  let plan = (account.plan as PlanId) || "basic";
  const now = new Date();

  // Safe isolated block to verify against active checkout records
  try {
    const latestSuccessPayment = await prisma.payment.findFirst({
      where: { ownerId: resolvedOwnerId, status: "success" },
      orderBy: { createdAt: "desc" },
    });

    if (latestSuccessPayment && latestSuccessPayment.periodEnd > now) {
      currentStatus = "active";
      currentPeriodEnd = latestSuccessPayment.periodEnd;
      plan = (latestSuccessPayment.plan as PlanId) || plan;

      if (account.subscriptionStatus !== "active" || account.plan !== latestSuccessPayment.plan) {
        await prisma.user.update({
          where: { id: resolvedOwnerId },
          data: {
            subscriptionStatus: "active",
            plan: latestSuccessPayment.plan,
            currentPeriodEnd: latestSuccessPayment.periodEnd,
          },
        }).catch(err => console.error("Self-healing sync failed:", err));
      }
    }
  } catch (err) {
    console.error("Payment fallback verification check failed silently:", err);
  }

  let isLocked = false;
  let trialDaysLeft: number | null = null;

  if (currentStatus === "trialing") {
    if (!account.trialEndsAt || account.trialEndsAt < now) {
      isLocked = true;
    } else {
      trialDaysLeft = Math.ceil((account.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      // Active trial: everything unlocked, same as Premium, regardless of
      // whichever plan is stored on the account.
      plan = "premium";
    }
  } else if (currentStatus === "active") {
    if (currentPeriodEnd && currentPeriodEnd < now) {
      isLocked = true;
    }
  } else {
    isLocked = true;
  }

  // Max Package override — takes precedence over everything computed above.
  // While ON, this owner is never locked and always resolves to "max"
  // (unlimited everything), regardless of trial/period expiry or whatever
  // the payment self-healing block above resolved `plan` to. This is set
  // automatically on successful Max payment, or manually by an admin.
  if (account.maxPackageEnabled) {
    plan = "max";
    isLocked = false;
  }

  return {
    plan,
    subscriptionStatus: currentStatus,
    trialEndsAt: account.trialEndsAt,
    currentPeriodEnd,
    isLocked,
    trialDaysLeft,
  };
});

/**
 * Throws if the owner's subscription is locked (trial or paid period
 * expired without renewal). Call this at the top of any mutating server
 * action — create/update/delete — for both owner and staff flows.
 */
export async function assertSubscriptionActive(ownerId: number): Promise<void> {
  const status = await getBillingStatus(ownerId);
  if (status.isLocked) {
    throw new Error(
      "SUBSCRIPTION_LOCKED: Your free trial or subscription has ended. Please upgrade to continue."
    );
  }
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
}

/**
 * Checks a specific plan limit (stores, staff, products) against current usage.
 * Automatically handles staff resolving back to owner accounts.
 */
export async function checkPlanLimit(
  idParam: number,
  kind: "stores" | "staff" | "products"
): Promise<LimitCheckResult> {
  let resolvedOwnerId = idParam;
  
  const user = await prisma.user.findUnique({ 
    where: { id: idParam }, 
    select: { role: true, ownerId: true, plan: true, subscriptionStatus: true, trialEndsAt: true, fullName: true, maxPackageEnabled: true } 
  });
  
  if (user && user.role === "staff" && user.ownerId) {
    resolvedOwnerId = user.ownerId;
  }

  const owner = resolvedOwnerId === idParam
    ? user
    : await prisma.user.findUnique({ where: { id: resolvedOwnerId }, select: { plan: true, subscriptionStatus: true, trialEndsAt: true, fullName: true, maxPackageEnabled: true } });
  const plan = getPlanConfig(
    owner ? resolveEffectivePlanId(owner) : undefined
  );
  const limitReachedMessage = LIMIT_REACHED_PREFIX + formatLimitReachedMessage(owner?.fullName);

  if (kind === "stores") {
    const count = await prisma.store.count({ where: { ownerId: resolvedOwnerId } });
    const limit = plan.maxStores;
    return count >= limit
      ? { allowed: false, reason: limitReachedMessage, limit, current: count }
      : { allowed: true, limit, current: count };
  }

  if (kind === "staff") {
    const count = await prisma.user.count({ where: { ownerId: resolvedOwnerId, role: "staff" } });
    const limit = plan.maxStaff;
    return count >= limit
      ? { allowed: false, reason: limitReachedMessage, limit, current: count }
      : { allowed: true, limit, current: count };
  }

  // products — counts BOTH standard Inventory and ScaleInventory, since an
  // owner's plan limit applies to total product count regardless of which
  // store type a given product belongs to.
  const [standardCount, scaleCount] = await Promise.all([
    prisma.inventory.count({ where: { ownerId: resolvedOwnerId } }),
    prisma.scaleInventory.count({ where: { ownerId: resolvedOwnerId } }),
  ]);
  const count = standardCount + scaleCount;
  const limit = plan.maxProducts;
  return count >= limit
    ? { allowed: false, reason: limitReachedMessage, limit, current: count }
    : { allowed: true, limit, current: count };
}

/**
 * The plan-gated features that also have an admin-only override — an
 * admin flipping the matching *Override column on the User model grants
 * the feature regardless of plan tier, permanently, until turned back
 * off. This is the ONE place that formula lives: `plan allows it OR the
 * override is on`, never plan alone and never override alone. Every gate
 * on these four features — UI visibility and the server action itself —
 * should call hasFeatureAccess()/assertFeatureAllowed() below rather than
 * reading plan[feature] or the override column directly, so a future
 * feature can't accidentally skip the override half of the check the way
 * debtors/customerProfiles/consignment all did before this existed.
 *
 * businessSummaryChart has no override column — it never needed one, so
 * it's intentionally left out of FEATURE_OVERRIDE_FIELD below rather than
 * given a fake always-false one.
 */
export type GatedFeature = "businessSummaryChart" | "staffConsignment" | "ownerConsignment" | "debtors" | "customerProfiles";

const FEATURE_OVERRIDE_FIELD: Partial<Record<GatedFeature, "staffConsignmentOverride" | "ownerConsignmentOverride" | "debtorsOverride" | "customerProfilesOverride">> = {
  staffConsignment: "staffConsignmentOverride",
  ownerConsignment: "ownerConsignmentOverride",
  debtors: "debtorsOverride",
  customerProfiles: "customerProfilesOverride",
};

export interface FeatureAccessAccount {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  maxPackageEnabled?: boolean | null;
  staffConsignmentOverride?: boolean | null;
  ownerConsignmentOverride?: boolean | null;
  debtorsOverride?: boolean | null;
  customerProfilesOverride?: boolean | null;
}

/**
 * The actual `plan OR override` check. Pure function, no DB access — pass
 * in an account record that already has the plan/trial fields AND
 * whichever *Override column this feature needs (assertFeatureAllowed
 * below handles fetching that; call this directly if you already have the
 * record loaded, e.g. inside an action that fetched `owner` for other
 * reasons too, to avoid a redundant query).
 */
export function hasFeatureAccess(account: FeatureAccessAccount, feature: GatedFeature): boolean {
  const plan = getPlanConfig(resolveEffectivePlanId(account));
  if (plan[feature]) return true;

  const overrideField = FEATURE_OVERRIDE_FIELD[feature];
  return overrideField ? !!account[overrideField] : false;
}

/**
 * Throws if a plan-gated feature isn't included in the owner's current
 * plan AND no admin override is on for it. Fetches the account itself —
 * use hasFeatureAccess() directly instead if the caller already has the
 * owner record loaded (avoids a redundant query).
 */
export async function assertFeatureAllowed(idParam: number, feature: GatedFeature): Promise<void> {
  let resolvedOwnerId = idParam;
  const selectFields = {
    role: true, ownerId: true, plan: true, subscriptionStatus: true, trialEndsAt: true, maxPackageEnabled: true,
    staffConsignmentOverride: true, ownerConsignmentOverride: true, debtorsOverride: true, customerProfilesOverride: true,
  } as const;

  const user = await prisma.user.findUnique({ where: { id: idParam }, select: selectFields });

  if (user && user.role === "staff" && user.ownerId) {
    resolvedOwnerId = user.ownerId;
  }

  const owner = resolvedOwnerId === idParam
    ? user
    : await prisma.user.findUnique({ where: { id: resolvedOwnerId }, select: selectFields });

  if (!owner || !hasFeatureAccess(owner, feature)) {
    throw new Error(
      `UPGRADE_REQUIRED: This feature isn't available on your current plan. Please upgrade to access it.`
    );
  }
}