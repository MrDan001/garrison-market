// FILE: apps/frontend/lib/debt.actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "./auth.actions";
import { revalidatePath } from "next/cache";
import { createNotification } from "./notification.actions";
import { getActiveStoreId } from "./store-context";

// ============================================================================
// Staff — open debts list
// ============================================================================
// A debt isn't tied to whichever staff member happened to be at the till
// when the part payment was taken — the customer can walk back in on
// anyone's shift to pay more. So this is scoped to the OWNER + active
// store, not to session.id, unlike e.g. getOpenConsignmentsForStaff (which
// IS staff-scoped, since consignment stock is physically signed out to one
// person). Only "owing" debts show here — settled ones drop off the list
// once the balance hits zero.
export async function getOpenDebtsForStaff() {
  const session = await getSessionUser();
  if (!session) return [];

  const ownerScopeId = session.role === "owner" ? session.id : session.ownerId!;
  const storeId = await getActiveStoreId();

  return prisma.debt.findMany({
    where: {
      ownerId: ownerScopeId,
      status: "owing",
      ...(storeId ? { storeId } : {}),
    },
    include: {
      customer: { select: { name: true, phone: true } },
      order: {
        include: {
          // A debt's order can be a "list" sale, a scale sale, or a merged
          // mix of both — items covers the first, scaleItems the other
          // two, so both have to be pulled or scale-only sales show an
          // empty items list.
          items: { include: { inventory: { select: { name: true } } } },
          scaleItems: { include: { scaleInventory: { select: { name: true } } } },
          staff: { select: { fullName: true } },
        },
      },
      payments: {
        include: { staff: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================================================
// Owner — open debts, grouped for the Customers page
// ============================================================================
// Same shape as getOpenDebtsForStaff (customer, order+items+staff,
// payments+staff) but scoped to the owner's own id directly (no
// staff-vs-owner ownerScopeId dance needed — this is only ever called from
// an owner-only page) and restricted to session.role === "owner" the same
// way getCustomersForOwner is. Powers the debt badge + Debts tab on
// /owner/customers; customers-client.tsx groups these by customerId.
export async function getOpenDebtsForOwner() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") return [];

  const storeId = await getActiveStoreId();

  return prisma.debt.findMany({
    where: {
      ownerId: session.id,
      status: "owing",
      ...(storeId ? { storeId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      order: {
        include: {
          items: { include: { inventory: { select: { name: true } } } },
          scaleItems: { include: { scaleInventory: { select: { name: true } } } },
          staff: { select: { fullName: true } },
        },
      },
      payments: {
        include: { staff: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================================================
// Staff — log a follow-up payment against an open debt
// ============================================================================
// Called when a debtor comes back and pays some or all of what's left.
// Locks the debt via an optimistic-lock updateMany the same way
// settleConsignment does — only succeeds while status is still "owing", so
// two near-simultaneous submissions (e.g. a double-tap, or two staff
// members both trying to log the same payment) can't both apply.
export async function recordDebtPaymentAction(debtId: number, amount: number, paymentMethod: "cash" | "transfer") {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const ownerScopeId = session.role === "owner" ? session.id : session.ownerId!;

  if (isNaN(amount) || amount <= 0) {
    throw new Error("Enter a valid payment amount.");
  }
  if (paymentMethod !== "cash" && paymentMethod !== "transfer") {
    throw new Error("Select how this payment was received.");
  }

  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
    include: { customer: { select: { name: true, phone: true } } },
  });
  if (!debt) throw new Error("Debt record not found.");
  if (debt.ownerId !== ownerScopeId) throw new Error("Unauthorized");
  if (debt.status !== "owing") throw new Error("This debt is already settled.");

  const remaining = Number(debt.totalAmount) - Number(debt.amountPaid);
  if (amount > remaining) {
    throw new Error(`That's more than what's owed (₦${remaining.toLocaleString()} remaining).`);
  }

  const newAmountPaid = Number(debt.amountPaid) + amount;
  const isNowSettled = newAmountPaid >= Number(debt.totalAmount);

  await prisma.$transaction(async (tx) => {
    const lock = await tx.debt.updateMany({
      where: { id: debtId, status: "owing" },
      data: {
        amountPaid: newAmountPaid,
        ...(isNowSettled ? { status: "settled", settledAt: new Date() } : {}),
      },
    });
    if (lock.count === 0) {
      throw new Error("This debt was just updated by someone else — please refresh and try again.");
    }

    await tx.debtPayment.create({
      data: {
        debtId,
        amount,
        paymentMethod,
        staffId: session.id,
      },
    });
  }, { maxWait: 10000, timeout: 20000 });

  const soldByStaff = session.role !== "owner"
    ? await prisma.user.findUnique({ where: { id: session.id }, select: { fullName: true } })
    : null;
  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

  await createNotification({
    ownerId: debt.ownerId,
    recipientId: null,
    storeId: debt.storeId,
    type: "debt_logged",
    message: isNowSettled
      ? `${debt.customer.name} paid off their remaining balance${soldByStaff?.fullName ? ` (logged by ${soldByStaff.fullName})` : ""} — debt settled.`
      : `${debt.customer.name} paid ${naira} more${soldByStaff?.fullName ? ` (logged by ${soldByStaff.fullName})` : ""} — ₦${(Number(debt.totalAmount) - newAmountPaid).toLocaleString()} still owed.`,
    link: "/owner/customers",
  });

  revalidatePath("/staff/debts");
  revalidatePath("/owner/customers");
  return { success: true, settled: isNowSettled };
}