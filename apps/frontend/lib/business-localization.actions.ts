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

  await prisma.user.update({
    where: { id: session.id },
    data: { businessCountry, currencyCode },
  });

  revalidatePath("/owner", "layout");
  revalidatePath("/staff", "layout");
  return { success: true, message: "Business country and currency updated." };
}
