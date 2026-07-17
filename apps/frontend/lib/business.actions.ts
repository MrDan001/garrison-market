"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { put } from "@vercel/blob";
import { redirect } from "next/navigation";
import { createNotification } from "./notification.actions";
import { getActiveStoreId } from "./store-context";

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
  const cashTotal = recentSales
    .filter((s: any) => s.paymentMethod === "cash")
    .reduce((sum: number, s: any) => sum + Number(s.total), 0);
  const transferTotal = recentSales
    .filter((s: any) => s.paymentMethod === "transfer")
    .reduce((sum: number, s: any) => sum + Number(s.total), 0);

  await prisma.report.create({
    data: {
      totalSales: totalValue,
      cashTotal,
      transferTotal,
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

  const storeId = await getActiveStoreId();

  return await prisma.inventory.findMany({
    where: {
      ownerId: targetOwnerId,
      ...(storeId ? { storeId } : {}),
    },
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
  const storeId = await getActiveStoreId();

  const newItem = await prisma.inventory.create({
    data: {
      name,
      quantity,
      costPrice,
      price,
      category,
      restockLevel,
      image: imageUrl,
      ownerId: session.id,
      storeId: storeId ?? undefined,
    },
  });

  await createNotification({
    ownerId: session.id,
    recipientId: null,
    type: "new_item",
    message: `${newItem.name} was added to inventory.`,
    link: "/staff/inventory",
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

export async function processSaleAction(cartItems: any[], paymentMethod: "cash" | "transfer") {
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
      paymentMethod,
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
    const before = await prisma.inventory.findUnique({ where: { id: item.id } });

    const updated = await prisma.inventory.update({
      where: { id: item.id },
      data: { quantity: { decrement: item.qty } }
    });

    // Fire only the moment the item crosses into low/out-of-stock —
    // not on every sale after it's already low.
    if (
      before &&
      updated.restockLevel != null &&
      before.quantity > updated.restockLevel &&
      updated.quantity <= updated.restockLevel
    ) {
      await createNotification({
        ownerId: updated.ownerId,
        recipientId: null,
        type: "low_stock",
        message: updated.quantity <= 0
          ? `${updated.name} is now out of stock.`
          : `${updated.name} is running low (${updated.quantity} left).`,
        link: "/staff/inventory",
      });
    }
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
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: status }
  });

  await createNotification({
    ownerId: report.ownerId,
    recipientId: report.authorId,
    type: "report_status",
    message: `Your report was ${status}.`,
    link: "/staff/report",
  });

  revalidatePath("/owner/report");
}

export async function requestReportRevision(reportId: number, note: string) {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") throw new Error("Unauthorized");
  if (!note.trim()) throw new Error("Please explain what needs correcting");

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: "revision_requested", ownerNote: note.trim() },
  });

  await createNotification({
    ownerId: report.ownerId,
    recipientId: report.authorId,
    type: "report_status",
    message: "Your report was sent back — a correction is needed.",
    link: "/staff/report",
  });

  revalidatePath("/owner/report");
  revalidatePath("/staff/report");
  return { success: true };
}

export async function resubmitReportAction(reportId: number, clarification: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  if (!clarification.trim()) throw new Error("Please add a clarification note");

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  if (report.authorId !== session.id) throw new Error("Unauthorized");
  if (report.status !== "revision_requested") throw new Error("This report isn't awaiting correction");

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: "pending",
      notes: `${report.notes}\n\n[Clarification]: ${clarification.trim()}`,
      ownerNote: null,
    },
  });

  await createNotification({
    ownerId: report.ownerId,
    recipientId: null,
    type: "report_status",
    message: "A staff report was resubmitted with a clarification.",
    link: "/owner/report",
  });

  revalidatePath("/staff/report");
  revalidatePath("/owner/report");
  return { success: true };
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
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const productsSold = formData.get("productsSold") as string;

  if (!name) throw new Error("Store name is required.");

  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) throw new Error("User not found.");

  await prisma.store.create({
    data: {
      name,
      phoneNumber: phoneNumber || null,
      address: address || null,
      city: city || null,
      state: state || null,
      productsSold: productsSold || null,
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