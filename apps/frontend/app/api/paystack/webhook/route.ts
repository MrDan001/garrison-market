import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/paystack";
import { BILLING_CYCLES, type BillingCycleId, type PlanId } from "@/lib/plans";
import { createNotification } from "@/lib/notification.actions";
import { creditReferralReward } from "@/lib/referral.actions"; // 👇 IMPORT YOUR REWARD UTILITY

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook: invalid signature.");
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference: string = event.data?.reference;
  if (!reference) return NextResponse.json({ received: true });

  try {
    const verified = await verifyTransaction(reference);
    if (verified.status !== "success") {
      return NextResponse.json({ received: true });
    }

    const payment = await prisma.payment.findUnique({ where: { reference } });
    if (!payment) {
      console.error("Paystack webhook: no matching Payment row for reference", reference);
      return NextResponse.json({ received: true });
    }

    if (payment.status === "success") {
      return NextResponse.json({ received: true });
    }

    const metadata = verified.metadata || {};
    const plan = (metadata.plan as PlanId) || (payment.plan as PlanId);
    const cycle = (metadata.cycle as BillingCycleId) || "quarterly";
    const months = BILLING_CYCLES[cycle]?.months || 3;

    const owner = await prisma.user.findUnique({ where: { id: payment.ownerId } });
    if (!owner) return NextResponse.json({ received: true });

    const base = owner.currentPeriodEnd && owner.currentPeriodEnd > new Date()
      ? owner.currentPeriodEnd
      : new Date();
    const newPeriodEnd = new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    // Main Billing Activation State Sync
    await prisma.$transaction([
      prisma.payment.update({
        where: { reference },
        data: { status: "success", periodEnd: newPeriodEnd },
      }),
      prisma.user.update({
        where: { id: payment.ownerId },
        data: {
          plan,
          subscriptionStatus: "active",
          currentPeriodEnd: newPeriodEnd,
          paystackCustomerCode: verified.customer?.customer_code || owner.paystackCustomerCode,
          paystackAuthorizationCode: verified.authorization?.authorization_code || owner.paystackAuthorizationCode,
        },
      }),
    ]);

    // 👇 CHANNELS THE SUBSCRIBED USER'S CONVERSION THROUGH THE REFERRAL ENGINE
    // If this subscriber has a referrer, Mr. A instantly gains 7 premium days
    try {
      await creditReferralReward(payment.ownerId);
    } catch (refError) {
      // Wrapped in a try/catch so referral process issues never disrupt the main payment lifecycle execution
      console.error("Referral process error (payment went through fine):", refError);
    }

    await createNotification({
      ownerId: payment.ownerId,
      recipientId: null,
      storeId: null,
      type: "announcement",
      message: `Payment received — your ${plan === "premium" ? "Premium" : "Basic"} plan is now active until ${newPeriodEnd.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.`,
      link: "/owner/billing",
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook processing error:", error);
    return NextResponse.json({ received: true });
  }
}