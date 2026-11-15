"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BUSINESS_COUNTRIES, isSupportedCurrency } from "@/lib/business-localization";

export async function updateBusinessLocalizationAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session?.id || session.role !== "owner") {
    return { error: "Only the business owner can update these settings." };
  }

  const businessCountry = String(formData.get("businessCountry") || "").trim().toUpperCase();
  const currencyCode = String(formData.get("currencyCode") || "").trim().toUpperCase();

  if (!BUSINESS_COUNTRIES.some((country) => country.code === businessCountry)) {
    return { error: "Choose a supported business country." };
  }
  if (!isSupportedCurrency(currencyCode)) {
    return { error: "Choose a supported operating currency." };
  }

  const currentProfile = await prisma.user.findUnique({
    where: { id: session.id },
    select: { currencyCode: true },
  });
  if (!currentProfile) return { error: "Business profile not found." };

  if (currentProfile.currencyCode !== currencyCode) {
    const [products, scaleProducts, orders, expenses, reports, debts] = await Promise.all([
      prisma.inventory.count({ where: { ownerId: session.id } }),
      prisma.scaleInventory.count({ where: { ownerId: session.id } }),
      prisma.order.count({ where: { ownerId: session.id } }),
      prisma.expense.count({ where: { ownerId: session.id } }),
      prisma.report.count({ where: { ownerId: session.id } }),
      prisma.debt.count({ where: { ownerId: session.id } }),
    ]);

    if (products + scaleProducts + orders + expenses + reports + debts > 0) {
      return {
        error: "Your operating currency is locked after inventory or business records have been created. Contact support if you need help migrating to another currency.",
      };
    }
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { businessCountry, currencyCode },
  });

  revalidatePath("/owner", "layout");
  revalidatePath("/staff", "layout");
  return { success: true, message: "Business country and currency updated." };
}
