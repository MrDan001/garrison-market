import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";

export const dynamic = "force-dynamic";

interface PrismaOrderItem {
  id: number;
  orderId: number;
  inventoryId: number;
  quantity: number;
  priceAtTime: any;
  inventory: {
    name: string;
  } | null;
}

interface PrismaScaleOrderItem {
  id: number;
  orderId: number;
  scaleInventoryId: number;
  quantity: any;
  unit: string;
  priceAtTime: any;
  scaleInventory: {
    name: string;
  } | null;
}

interface PrismaOrder {
  id: number;
  total: any;
  date: Date;
  ownerId: number;
  staffId: number | null;
  buyerName: string | null;
  buyerPhone: string | null;
  paymentMethod: string;
  staff: {
    fullName: string | null;
  } | null;
  owner: {
    storeName: string | null;
    fullName: string | null;
    email: string;
  } | null;
  items: PrismaOrderItem[];
  scaleItems: PrismaScaleOrderItem[];
}

export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "owner" && session.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownerId = session.role === "owner" ? session.id : session.ownerId!;

    const ownerProfile = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { fullName: true },
    });

    const orders = (await prisma.order.findMany({
      where: {
        ownerId,
        ...(session.role === "staff" ? { staffId: session.id } : {}),
      },
      include: {
        staff: { select: { fullName: true } },
        owner: { select: { storeName: true, fullName: true, email: true } },
        items: {
          include: {
            inventory: { select: { name: true } },
          },
        },
        scaleItems: {
          include: {
            scaleInventory: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    })) as unknown as PrismaOrder[];

    const serializedOrders = orders.map((order: PrismaOrder) => {
      // Robust decimal-to-number safe converter helper
      const safeNum = (val: any) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === "number") return val;
        if (typeof val === "object" && val !== null) {
          if (typeof val.toNumber === "function") return val.toNumber();
          if (typeof val.toString === "function") {
            const parsedStr = Number(val.toString());
            if (!isNaN(parsedStr)) return parsedStr;
          }
        }
        const parsed = Number(val);
        return isNaN(parsed) ? 0 : parsed;
      };

      return {
        id: order.id,
        total: safeNum(order.total),
        date: order.date.toISOString(),
        ownerId: order.ownerId,
        staffId: order.staffId,
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        paymentMethod: order.paymentMethod,
        staff: order.staff,
        owner: order.owner,
        items: [
          ...order.items.map((item: PrismaOrderItem) => ({
            id: item.id,
            orderId: item.orderId,
            inventoryId: item.inventoryId,
            quantity: safeNum(item.quantity),
            priceAtTime: safeNum(item.priceAtTime),
            inventory: item.inventory,
          })),
          ...order.scaleItems.map((item: PrismaScaleOrderItem) => {
            const lineTotal = safeNum(item.priceAtTime);
            const quantity = safeNum(item.quantity);
            const unitPrice = quantity > 0 ? lineTotal / quantity : 0;
            return {
              id: item.id,
              orderId: item.orderId,
              inventoryId: item.scaleInventoryId,
              quantity,
              priceAtTime: unitPrice,
              inventory: item.scaleInventory ? { name: `${item.scaleInventory.name} (${item.unit})` } : null,
            };
          }),
        ],
      };
    });

    return NextResponse.json({
      orders: serializedOrders,
      merchantName: ownerProfile?.fullName || "Store Owner",
    });
  } catch (error) {
    console.error("API Invoice fetching pipeline error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}