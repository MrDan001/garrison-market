"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth"; 
import { initializeTransaction } from "@/lib/paystack";
import { PLANS, BILLING_CYCLES, getCyclePrice, type PlanId, type BillingCycleId } from "@/lib/plans";
import { getBillingStatus } from "@/lib/subscription-guard";
import { creditReferralReward } from "@/lib/referral.actions";
import { headers } from "next/headers";
import crypto from "crypto";

export async function getOwnerBillingInfo() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  const ownerId = session.role === "owner" ? session.id : session.ownerId!;

  const status = await getBillingStatus(ownerId);
  const payments = await prisma.payment.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    status,
    payments: JSON.parse(JSON.stringify(payments)),
    isOwner: session.role === "owner",
  };
}

export async function startCheckoutAction(plan: PlanId, cycle: BillingCycleId) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") {
    return { error: "Only the store owner can manage billing." };
  }

  if (!PLANS[plan]) return { error: "Invalid plan selected." };
  if (!BILLING_CYCLES[cycle]) return { error: "Invalid billing cycle selected." };

  const amount = getCyclePrice(plan, cycle);
  const reference = `gm_${session.id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { email: true } });
    if (!user) return { error: "User not found." };

    const tx = await initializeTransaction({
      email: user.email,
      amountNaira: amount,
      reference,
      callbackUrl: `${baseUrl}/owner/billing/success`,
      metadata: { ownerId: session.id, plan, cycle },
    });

    const periodEnd = new Date(Date.now() + BILLING_CYCLES[cycle].months * 30 * 24 * 60 * 60 * 1000);
    await prisma.payment.create({
      data: {
        ownerId: session.id,
        plan,
        amount,
        reference,
        status: "pending",
        periodEnd,
      },
    });

    return { success: true, authorizationUrl: tx.authorization_url };
  } catch (error) {
    console.error("Paystack initialize error:", error);
    return { error: "Could not start checkout. Please try again." };
  }
}

/**
 * Direct Fallback Verification Action
 * Used if local webhooks fail to hit localhost. Fetches ground-truth data from 
 * Paystack directly and activates subscription states across tables in a transaction.
 */
export async function syncPaymentDirectly(reference: string) {
  try {
    if (!reference) return { error: "No reference provided" };

    const payment = await prisma.payment.findUnique({
      where: { reference },
    });

    if (!payment) return { error: "Transaction record not found locally." };
    if (payment.status === "success") return { success: true, status: "already_processed" };

    // Fetch live ground-truth check from Paystack APIs
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!paystackRes.ok) return { error: "Could not connect to Paystack verification API." };
    
    const paystackData = await paystackRes.json();

    if (paystackData.status === true && paystackData.data.status === "success") {
      // Complete database state synchronizations inside a safe atomic isolation block
      await prisma.$transaction([
        prisma.payment.update({
          where: { reference },
          data: { status: "success" },
        }),
        prisma.user.update({
          where: { id: payment.ownerId },
          data: {
            // 👇 FIXED: this previously wrote the plan name ("basic"/"premium")
            // into subscriptionStatus, and never touched the `plan` field at
            // all. That meant a successful payment never actually upgraded
            // the account — plan stayed "basic" forever, which silently
            // blocked every plan-gated feature (like consignment) even
            // after the owner paid for Premium.
            plan: payment.plan,
            subscriptionStatus: "active",
            currentPeriodEnd: payment.periodEnd,
            paystackCustomerCode: paystackData.data.customer?.customer_code || undefined,
            paystackAuthorizationCode: paystackData.data.authorization?.authorization_code || undefined,
          },
        }),
      ]);

      // ADDED: previously, a real successful payment (this direct-sync path,
      // and presumably the webhook path too, if one exists) never credited
      // the referrer's +7 day bonus — only a manual admin extension did.
      // This means referral rewards would only ever trigger via manual
      // admin action, never from an actual paying customer. Credit it here,
      // same as extendSubscriptionAction does, non-fatal if it fails.
      try {
        await creditReferralReward(payment.ownerId);
      } catch (refError) {
        console.error("Referral reward crediting failed after payment sync:", refError);
      }

      return { success: true, status: "success" };
    }

    return { success: false, status: paystackData?.data?.status || "pending" };
  } catch (error) {
    console.error("Manual fallback verification exception:", error);
    return { error: "An unexpected error occurred during database verification sync." };
  }
}