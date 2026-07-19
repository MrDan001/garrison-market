//lib/store.actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth.actions";
import prisma from "./prisma";

export async function switchStoreAction(storeId: number) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") {
    throw new Error("Unauthorized");
  }

  // Critical check: the store being switched to must actually belong to
  // this owner. Without this, any authenticated user could point their
  // activeStoreId cookie at a completely different owner's store.
  const store = await prisma.store.findFirst({
    where: { id: storeId, ownerId: session.id },
    select: { id: true },
  });
  if (!store) {
    throw new Error("Store not found or does not belong to you.");
  }

  const cookieStore = await cookies();
  cookieStore.set("activeStoreId", storeId.toString(), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  await prisma.user.update({
    where: { id: session.id },
    data: { currentStoreId: storeId },
  });

  redirect("/owner/dashboard");
}

export async function updateStaffStoreAction(staffId: number, storeId: number) {
    const cookieStore = await cookies();
    const { getSessionUser } = await import("./auth.actions");
    const session = await getSessionUser();
    if (!session || session.role !== "owner") throw new Error("Unauthorized");
  
    const prisma = (await import("./prisma")).default;
  
    // Confirm both the staff member and the store belong to this owner
    const [staff, store] = await Promise.all([
      prisma.user.findFirst({ where: { id: staffId, ownerId: session.id, role: "staff" } }),
      prisma.store.findFirst({ where: { id: storeId, ownerId: session.id } }),
    ]);
  
    if (!staff) throw new Error("Staff member not found");
    if (!store) throw new Error("Store not found");
  
    await prisma.user.update({
      where: { id: staffId },
      data: { staffStoreId: storeId },
    });
  
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/owner/staff/${staffId}`);
    revalidatePath("/owner/staff");
  
    return { success: true };
  }