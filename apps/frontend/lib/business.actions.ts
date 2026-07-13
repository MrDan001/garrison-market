"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { createNotification } from "./notification.actions";

export async function submitDailyReport(authorId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.id !== authorId) throw new Error("Unauthorized");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReportToday = await prisma.report.findFirst({
    where: { authorId, date: { gte: today } },
    orderBy: { date: 'desc' }
  });

  const salesStartTime = lastReportToday ? new Date(lastReportToday.date) : today;

  const recentSales = await prisma.order.findMany({
    where: { staffId: authorId, date: { gte: salesStartTime } },
    include: { items: { include: { inventory: true } } }
  });

  const allSoldItems = recentSales.flatMap((s: any) => s.items);
  const totalValue = recentSales.reduce((sum: number, s: any) => sum + Number(s.total), 0);

  await prisma.report.create({
    data: {
      totalSales: totalValue,
      notes: content && content.trim() !== "" ? content.trim() : "None",
      status: "pending",
      author: { connect: { id: authorId } },
      ownerId: session.ownerId!,
      items: {
        create: allSoldItems.map((i: any) => ({
          inventoryId: i.inventoryId,
          name: i.inventory?.name ?? "Unknown Item",
          quantity: i.quantity,
          price: i.priceAtTime,
          total: Number(i.priceAtTime) * i.quantity,
          ...(i.discountValue
            ? {
                originalPrice: i.originalPrice,
                discountValue: i.discountValue,
                discountType: i.discountType,
                discountReason: i.discountReason,
              }
            : {}),
        })),
      },
    },
  });

  revalidatePath("/staff/report");
  return { success: true };
}

export async function createOrderAction(inventoryId: number) {
  const session = await getSessionUser();
  if (!session || !session.ownerId) throw new Error("Unauthorized");

  const item = await prisma.inventory.findUnique({
    where: { id: inventoryId, ownerId: session.ownerId }
  });

  if (item && item.quantity > 0) {
    await prisma.order.create({
      data: {
        total: item.price,
        ownerId: session.ownerId,
        staffId: session.id,
        items: {
          create: {
            inventoryId: item.id,
            quantity: 1,
            priceAtTime: item.price
          }
        }
      },
    });

    await prisma.inventory.update({
      where: { id: inventoryId },
      data: { quantity: { decrement: 1 } }
    });

    revalidatePath("/staff/orders");
  }
}

export async function getInventoryForStaff() {
  const session = await getSessionUser();
  const targetOwnerId = session?.ownerId || (session?.role === 'owner' ? session.id : null);
  if (!targetOwnerId) throw new Error("Unauthorized");

  return await prisma.inventory.findMany({
    where: { ownerId: targetOwnerId },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      costPrice: true,
      category: true,
      restockLevel: true,
      image: true,
      ownerId: true
    },
    orderBy: { name: "asc" }
  });
}

export async function addInventoryAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const price = parseFloat(formData.get("price") as string);

  await prisma.inventory.create({
    data: { name, quantity, price, ownerId: session.id }
  });

  revalidatePath("/owner/inventory");
}

export async function addItemAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = (formData.get("category") as string) || null;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);

  const imageUrl = (formData.get("imageUrl") as string) || null;

  await prisma.inventory.create({
    data: {
      name,
      quantity,
      costPrice,
      price,
      category,
      restockLevel,
      image: imageUrl,
      ownerId: session.id,
    },
  });

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function updateItemAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = formData.get("category") as string;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);

  const updateData: any = { name, quantity, costPrice, price, category, restockLevel };

  const imageUrl = formData.get("imageUrl") as string | null;
  if (imageUrl) {
    updateData.image = imageUrl;
  }

  try {
    await prisma.inventory.update({ where: { id }, data: updateData });
  } catch (dbError) {
    console.error("Database update failed:", dbError);
    throw dbError;
  }

  revalidatePath("/owner/inventory");
  return { success: true };
}

export async function processSaleAction(cartItems: any[]) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const total = cartItems.reduce((sum: number, item: any) => sum + (Number(item.price) * item.qty), 0);

  for (const item of cartItems) {
    const inventory = await prisma.inventory.findUnique({
      where: { id: item.id }
    });

    if (!inventory) throw new Error(`Item ${item.id} not found.`);
    if (inventory.quantity < item.qty) {
      throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}`);
    }
  }

  await prisma.order.create({
    data: {
      total: total,
      ownerId: session.role === 'owner' ? session.id : session.ownerId!,
      staffId: session.id,
      items: {
        create: cartItems.map((item: any) => ({
          inventoryId: item.id,
          quantity: item.qty,
          priceAtTime: Number(item.price),
          ...(item.discountValue
            ? {
                originalPrice: Number(item.originalPrice),
                discountValue: Number(item.discountValue),
                discountType: item.discountType ?? null,
                discountReason: item.discountReason ?? null,
              }
            : {}),
        }))
      }
    }
  });

  for (const item of cartItems) {
    await prisma.inventory.update({
      where: { id: item.id },
      data: { quantity: { decrement: item.qty } }
    });
  }

  revalidatePath("/staff/inventory");
  return { success: true };
}

export async function getStaffReports() {
  const session = await getSessionUser();
  if (!session) return [];

  try {
    return await prisma.report.findMany({
      where: {
        ...(session.role === 'staff'
          ? { authorId: session.id }
          : { ownerId: session.id })
      },
      include: {
        author: {
          select: { fullName: true, email: true, role: true }
        },
        items: true
      },
      orderBy: { date: 'desc' }
    });
  } catch (error) {
    console.error("Error fetching staff reports:", error);
    return [];
  }
}

export async function getTodaySales() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return await prisma.order.findMany({
    where: { staffId: session.id, date: { gte: startOfToday } },
    include: { items: { include: { inventory: true } } }
  });
}

export async function updateReportStatus(reportId: number, status: "approved" | "declined") {
  "use server";
  await prisma.report.update({
    where: { id: reportId },
    data: { status: status }
  });
  revalidatePath("/owner/report");
}

export async function updateInventoryQuantity(id: number, change: number) {
  "use server";
  await prisma.inventory.update({
    where: { id },
    data: { quantity: { increment: change } }
  });
  revalidatePath("/owner/inventory");
}

export async function getStaffOrderHistory() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  return await prisma.order.findMany({
    where: { staffId: session.id },
    include: { items: { include: { inventory: true } } },
    orderBy: { date: 'desc' },
    take: 100
  });
}

export async function createStoreAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session?.email) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;

  if (!name) throw new Error("Store name is required.");

  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) throw new Error("User not found.");

  await prisma.store.create({
    data: {
      name,
      phoneNumber: phoneNumber || null,
      ownerId: user.id,
    },
  });

  redirect("/owner/stores");
}

export async function deleteInventoryAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const item = await prisma.inventory.findUnique({ where: { id } });
  if (!item || item.ownerId !== session.id) throw new Error("Unauthorized");

  let archived = false;

  try {
    await prisma.inventory.delete({ where: { id } });
  } catch (error: any) {
    if (error.code === "P2003") {
      await prisma.inventory.update({
        where: { id },
        data: { quantity: 0 },
      });
      archived = true;
    } else {
      throw error;
    }
  }

  revalidatePath("/owner/inventory");
  return { success: true, archived };
}