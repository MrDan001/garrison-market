// lib/subscription-guard.ts
// Single source of truth for "is this owner allowed to do X right now".
// Both owner and staff actions should route through this — staff inherit
// their owner's subscription status.

import prisma from "@/lib/prisma";
import { getPlanConfig, type PlanId } from "@/lib/plans";

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
 */
export async function getBillingStatus(idParam: number): Promise<BillingStatus> {
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
    }
  } else if (currentStatus === "active") {
    if (currentPeriodEnd && currentPeriodEnd < now) {
      isLocked = true;
    }
  } else {
    isLocked = true;
  }

  return {
    plan,
    subscriptionStatus: currentStatus,
    trialEndsAt: account.trialEndsAt,
    currentPeriodEnd,
    isLocked,
    trialDaysLeft,
  };
}

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
    select: { role: true, ownerId: true, plan: true } 
  });
  
  if (user && user.role === "staff" && user.ownerId) {
    resolvedOwnerId = user.ownerId;
  }

  const owner = resolvedOwnerId === idParam ? user : await prisma.user.findUnique({ where: { id: resolvedOwnerId }, select: { plan: true } });
  const plan = getPlanConfig(owner?.plan);

  if (kind === "stores") {
    const count = await prisma.store.count({ where: { ownerId: resolvedOwnerId } });
    const limit = plan.maxStores;
    return count >= limit
      ? { allowed: false, reason: `Your ${plan.name} plan allows up to ${limit} store(s). Upgrade to add more.`, limit, current: count }
      : { allowed: true, limit, current: count };
  }

  if (kind === "staff") {
    const count = await prisma.user.count({ where: { ownerId: resolvedOwnerId, role: "staff" } });
    const limit = plan.maxStaff;
    return count >= limit
      ? { allowed: false, reason: `Your ${plan.name} plan allows up to ${limit} staff member(s). Upgrade to add more.`, limit, current: count }
      : { allowed: true, limit, current: count };
  }

  // products
  const count = await prisma.inventory.count({ where: { ownerId: resolvedOwnerId } });
  const limit = plan.maxProducts;
  return count >= limit
    ? { allowed: false, reason: `Your ${plan.name} plan allows up to ${limit} products. Upgrade to add more.`, limit, current: count }
    : { allowed: true, limit, current: count };
}

/**
 * Throws if a plan-gated feature isn't included in the owner's current plan.
 */
export async function assertFeatureAllowed(
  idParam: number,
  feature: "businessSummaryChart" | "consignment"
): Promise<void> {
  let resolvedOwnerId = idParam;
  const user = await prisma.user.findUnique({ where: { id: idParam }, select: { role: true, ownerId: true, plan: true } });
  
  if (user && user.role === "staff" && user.ownerId) {
    resolvedOwnerId = user.ownerId;
  }

  const owner = resolvedOwnerId === idParam ? user : await prisma.user.findUnique({ where: { id: resolvedOwnerId }, select: { plan: true } });
  const plan = getPlanConfig(owner?.plan);
  
  if (!plan[feature]) {
    throw new Error(
      `UPGRADE_REQUIRED: This feature is only available on the Premium plan. Please upgrade to access it.`
    );
  }
}