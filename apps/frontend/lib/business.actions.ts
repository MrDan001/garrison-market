"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";
import { put } from "@vercel/blob"; 
import { redirect } from "next/navigation";



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

  const itemizedList = allSoldItems
    .map((i: any) => `${i.inventory?.name} (Price: ₦${Number(i.priceAtTime).toLocaleString()}, Qty: ${i.quantity}, Total: ₦${(Number(i.priceAtTime) * i.quantity).toLocaleString()})`)
    .join(" | ");

  const cleanStaffNotes = content && content.trim() !== "" ? content.trim() : "None";
  const exactSnapshotContent = `TOTAL SALES: ₦${totalValue.toLocaleString()}. ITEMS: ${itemizedList || "None"}. NOTES: ${cleanStaffNotes}`;

  await prisma.report.create({
    data: {
      content: exactSnapshotContent,
      status: "pending",
      author: { connect: { id: authorId } },
      ownerId: session.ownerId!
    }
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
      image: true, // 🌟 Ensure this line is present to pull image URLs from the DB
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
  if (!session || session.role !== 'owner') throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = formData.get("category") as string;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);
  
  const imageFile = formData.get("image") as File | null;
  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0 && imageFile.name !== "undefined") {
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const fileExtension = imageFile.name.split('.').pop() || "jpg";
      const blobPath = `products/${session.id}_${Date.now()}.${fileExtension}`;

      const blob = await put(blobPath, fileBuffer, {
        access: "public",
        contentType: imageFile.type, 
      });

      imageUrl = blob.url; 
    } catch (err) {
      console.error("Vercel Blob asset upload pipeline exploded:", err);
    }
  }

  await prisma.inventory.create({
    data: { 
      name, 
      quantity, 
      costPrice, 
      price, 
      category, 
      restockLevel,
      image: imageUrl, 
      ownerId: session.id 
    }
  });

  revalidatePath("/owner/inventory");
}

// ── Added brand new Update/Restock Action ──
export async function updateItemAction(formData: FormData) {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') throw new Error("Unauthorized");

  const id = parseInt(formData.get("id") as string, 10);
  if (isNaN(id)) throw new Error("Invalid product ID");

  const name = formData.get("name") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const costPrice = parseFloat(formData.get("costPrice") as string);
  const price = parseFloat(formData.get("price") as string);
  const category = formData.get("category") as string;
  const restockLevel = parseInt(formData.get("restockLevel") as string, 10);

  const imageFile = formData.get("image") as File | null;
  
  let updateData: any = { 
    name, 
    quantity, 
    costPrice, 
    price, 
    category, 
    restockLevel 
  };

  if (imageFile && imageFile.size > 0 && imageFile.name !== "undefined") {
    try {
      const arrayBuffer = await imageFile.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const fileExtension = imageFile.name.split('.').pop() || "jpg";
      const blobPath = `products/${session.id}_${Date.now()}.${fileExtension}`;

      const blob = await put(blobPath, fileBuffer, {
        access: "public",
        contentType: imageFile.type,
      });

      updateData.image = blob.url;
    } catch (err) {
      console.error("Vercel Blob update failed:", err);
    }
  }

  try {
    await prisma.inventory.update({
      where: { id },
      data: updateData
    });
  } catch (dbError) {
    console.error("Database update failed:", dbError);
    throw dbError;
  }

  // CRITICAL FIX: Placed outside of try/catch blocks to avoid NEXT_REDIRECT interference
  revalidatePath("/owner/inventory");
  redirect("/owner/inventory");
}

export async function processSaleAction(cartItems: any[]) {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");

  const total = cartItems.reduce((sum: number, item: any) => sum + (Number(item.price) * item.qty), 0);

  // Use individual operations instead of $transaction to avoid type conflicts with extended client
  // 1. Validate Stock Availability
  for (const item of cartItems) {
    const inventory = await prisma.inventory.findUnique({
      where: { id: item.id }
    });

    if (!inventory) throw new Error(`Item ${item.id} not found.`);
    if (inventory.quantity < item.qty) {
      throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}`);
    }
  }

  // 2. Create the Order
  await prisma.order.create({
    data: {
      total: total,
      ownerId: session.role === 'owner' ? session.id : session.ownerId!,
      staffId: session.id,
      items: {
        create: cartItems.map((item: any) => ({
          inventoryId: item.id,
          quantity: item.qty,
          priceAtTime: Number(item.price)
        }))
      }
    }
  });

  // 3. Decrement Inventory
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
        }
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

  // Create the store in the database
  await prisma.store.create({
    data: {
      name,
      phoneNumber: phoneNumber || null,
      ownerId: user.id,
    },
  });

  // Redirect to your stores page
  redirect("/owner/stores");
}