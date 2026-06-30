"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "./auth.actions";

export async function submitDailyReport(authorId: number, content: string) {
  const session = await getSessionUser();
  if (!session || session.id !== authorId) throw new Error("Unauthorized");

  // 1. Get the start of today (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. Find their last report submitted today to see when this shift/batch started
  const lastReportToday = await prisma.report.findFirst({
    where: { 
      authorId, 
      date: { gte: today } 
    },
    orderBy: { date: 'desc' }
  });

  // If they already submitted today, calculate sales starting right after that report.
  // Otherwise, calculate all sales from midnight.
  const salesStartTime = lastReportToday ? new Date(lastReportToday.date) : today;

  // 3. Fetch ONLY the specific sales and item quantities matching this shift timeline
  const recentSales = await prisma.order.findMany({
    where: {
      staffId: authorId,
      date: { gte: salesStartTime }
    },
    include: {
      items: {
        include: { inventory: true }
      }
    }
  });

  // 4. Calculate batch totals and format the exact items snapshot
  const allSoldItems = recentSales.flatMap((s: any) => s.items);
  const totalValue = recentSales.reduce((sum: number, s: any) => sum + Number(s.total), 0);

  const itemizedList = allSoldItems
    .map((i: any) => `${i.inventory?.name} (Price: ₦${Number(i.priceAtTime).toLocaleString()}, Qty: ${i.quantity}, Total: ₦${(Number(i.priceAtTime) * i.quantity).toLocaleString()})`)
    .join(" | ");

  // 💡 Cleaned up text construction so NOTES: stays separated at the very end
  const cleanStaffNotes = content && content.trim() !== "" ? content.trim() : "None";
  const exactSnapshotContent = `TOTAL SALES: ₦${totalValue.toLocaleString()}. ITEMS: ${itemizedList || "None"}. NOTES: ${cleanStaffNotes}`;

  // 5. Create the fresh pending report for the owner
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

  // Fetch the current price from the database
  const item = await prisma.inventory.findUnique({ 
    where: { id: inventoryId, ownerId: session.ownerId }
  });
  
  if (item && item.quantity > 0) {
    await prisma.order.create({
      data: {
        total: item.price,
        ownerId: session.ownerId,
        staffId: session.id, // Ensure staffId is captured here
        items: { 
          create: { 
            inventoryId: item.id, 
            quantity: 1, 
            priceAtTime: item.price // FIX: Use the actual item price
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
    // If staff, use session.ownerId. If owner, use session.id.
    const targetOwnerId = session?.ownerId || (session?.role === 'owner' ? session.id : null);
    
    if (!targetOwnerId) throw new Error("Unauthorized");
  
    return await prisma.inventory.findMany({
      where: { ownerId: targetOwnerId }
    });
  }
  export async function addInventoryAction(formData: FormData) {
    const session = await getSessionUser();
    if (!session || session.role !== 'owner') throw new Error("Unauthorized");
  
    const name = formData.get("name") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    const price = parseFloat(formData.get("price") as string);
  
    await prisma.inventory.create({
      data: {
        name,
        quantity,
        price,
        ownerId: session.id, // STAMP: Items are locked to this owner
      }
    });
  
    revalidatePath("/owner/inventory");
  }
  export async function addItemAction(formData: FormData) {
    const session = await getSessionUser();
    if (!session || session.role !== 'owner') throw new Error("Unauthorized");
  
    const name = formData.get("name") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    const price = parseFloat(formData.get("price") as string);
  
    await prisma.inventory.create({
      data: {
        name,
        quantity,
        price,
        ownerId: session.id, // Ensures the item belongs only to this owner
      },
    });
  
    revalidatePath("/owner/inventory"); // Refreshes the page to show the new item
  }
  export async function processSaleAction(cartItems: any[]) {
    const session = await getSessionUser();
    if (!session) throw new Error("Unauthorized");
  
    // Calculate total
    const total = cartItems.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
  
    await prisma.$transaction(async (tx) => {
      // 1. Validate Stock Availability
      for (const item of cartItems) {
        const inventory = await tx.inventory.findUnique({ 
          where: { id: item.id } 
        });
  
        if (!inventory) {
          throw new Error(`Item ${item.id} not found.`);
        }
  
        if (inventory.quantity < item.qty) {
          throw new Error(`Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}`);
        }
      }
  
      // 2. Create the Order
      await tx.order.create({
        data: {
          total: total,
          ownerId: session.role === 'owner' ? session.id : session.ownerId!,
          staffId: session.id,
          items: {
            create: cartItems.map(item => ({
              inventoryId: item.id,
              quantity: item.qty,
              priceAtTime: Number(item.price)
            }))
          }
        }
      });
  
      // 3. Decrement Inventory
      for (const item of cartItems) {
        await tx.inventory.update({
          where: { id: item.id },
          data: { 
            quantity: { decrement: item.qty } 
          }
        });
      }
    });
  
    revalidatePath("/staff/inventory");
    return { success: true };
  }


  export async function getStaffReports() {
    const session = await getSessionUser();
    if (!session) return [];
  
    try {
      return await prisma.report.findMany({
        where: { 
          // Staff see their own, Owners see all for their business
          ...(session.role === 'staff' 
              ? { authorId: session.id } 
              : { ownerId: session.id })
        },
        include: {
          author: { 
            select: {
              fullName: true, // Pulls the staff member's name
              email: true,    // Pulls the staff member's email
              role: true,
            }
          }
        },
        // Note: If your schema uses 'createdAt' instead of 'date', change this line to: createdAt: 'desc'
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
  
    // Define the start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
  
    return await prisma.order.findMany({
      where: {
        // Assuming you have a field linking order to staff, 
        // otherwise we use authorId or similar if orders are linked to user
        staffId: session.id, 
        date: { gte: startOfToday }
      },
      include: { items: { include: { inventory: true } } }
    });
  }
  // apps/frontend/lib/actions.ts
  
  // Ensure this is using 'number'
  export async function updateReportStatus(reportId: number, status: "approved" | "declined") {
    "use server";
    
    await prisma.report.update({
      where: { id: reportId }, // Prisma now sees this as a number
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
      include: {
        items: { include: { inventory: true } }
      },
      orderBy: { date: 'desc' },
      take: 100
    });
  }