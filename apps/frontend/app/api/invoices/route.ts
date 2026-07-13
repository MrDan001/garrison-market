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

interface PrismaOrder {
  id: number;
  total: any;
  date: Date;
  ownerId: number;
  staffId: number | null;
  staff: {
    fullName: string | null;
  } | null;
  owner: {
    storeName: string | null;
    fullName: string | null;
    email: string;
  } | null;
  items: PrismaOrderItem[];
}

export async function GET() {
  try {
    const session = await getSessionUser();

    if (!session || session.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // session only carries { id, email, role, status, ownerId } — fullName
    // isn't part of that selected shape, so fetch it directly instead of
    // assuming it exists on the session object.
    const ownerProfile = await prisma.user.findUnique({
      where: { id: session.id },
      select: { fullName: true },
    });

    const orders = (await prisma.order.findMany({
      where: { ownerId: session.id },
      include: {
        staff: { select: { fullName: true } },
        owner: { select: { storeName: true, fullName: true, email: true } },
        items: {
          include: {
            inventory: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    })) as unknown as PrismaOrder[];

    const serializedOrders = orders.map((order: PrismaOrder) => ({
      id: order.id,
      total: Number(order.total.toString()),
      date: order.date.toISOString(),
      ownerId: order.ownerId,
      staffId: order.staffId,
      staff: order.staff,
      owner: order.owner,
      items: order.items.map((item: PrismaOrderItem) => ({
        id: item.id,
        orderId: item.orderId,
        inventoryId: item.inventoryId,
        quantity: item.quantity,
        priceAtTime: Number(item.priceAtTime.toString()),
        inventory: item.inventory,
      })),
    }));

    return NextResponse.json({
      orders: serializedOrders,
      merchantName: ownerProfile?.fullName || "Store Owner",
    });
  } catch (error) {
    console.error("API Invoice fetching pipeline error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}