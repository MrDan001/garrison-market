"use server";
// lib/settings.actions.ts

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleDiscountAction(enabled: boolean) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { email: session.email },
    data: { discountEnabled: enabled },
  });

  revalidatePath("/owner/profile");
}

export async function toggleNotificationsAction(enabled: boolean) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { email: session.email },
    data: { notificationsEnabled: enabled },
  });

  revalidatePath("/owner/profile");
}

export async function toggleConsignmentAction(enabled: boolean) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.id },
    data: { consignmentEnabled: enabled },
  });

  revalidatePath("/owner/profile");
}

// Controls whether staff on a Scale store can see the wastage report
// (monthly totals + history). Staff can always SUBMIT a wastage entry
// regardless of this toggle — it only gates the report view.
export async function toggleWastageVisibilityAction(enabled: boolean) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.id },
    data: { wastageVisibleToStaff: enabled },
  });

  revalidatePath("/owner/profile");
}