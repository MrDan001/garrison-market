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
  buyerPhone: string | null; // FIXED: Added to interface types
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

    // Serves BOTH invoice pages: /staff/invoice (staff — their own sales
    // only) and /owner/invoices (owner — every order across the whole
    // business). Previously this hard-blocked anyone who wasn't "staff",
    // which meant the owner's own invoice page got a silent 403 on every
    // load and never showed anything — that was the bug.
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
        // Staff only ever see their own sales. Owners see everything —
        // no staffId filter at all, so owner-made sales (staffId: null)
        // and every staff member's sales all show up.
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

    const serializedOrders = orders.map((order: PrismaOrder) => ({
      id: order.id,
      total: Number(order.total.toString()),
      date: order.date.toISOString(),
      ownerId: order.ownerId,
      staffId: order.staffId,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone, // FIXED: Explicitly mapped and included in JSON response
      paymentMethod: order.paymentMethod,
      staff: order.staff,
      owner: order.owner,
      items: [
        ...order.items.map((item: PrismaOrderItem) => ({
          id: item.id,
          orderId: item.orderId,
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          priceAtTime: Number(item.priceAtTime.toString()),
          inventory: item.inventory,
        })),
        // Scale-sold items (from Scale Consignment sales) previously never
        // appeared here at all — this route only ever selected `items`,
        // never `scaleItems`, so any scale sale showed up as a blank
        // invoice with zero line items even though the sale was real.
        //
        // IMPORTANT: ScaleOrderItem.priceAtTime is stored as the LINE
        // TOTAL (price-per-base-unit × quantity sold — see
        // sellFromScaleConsignmentAction/processMergedSaleAction), unlike
        // regular OrderItem.priceAtTime which is a genuine per-unit price.
        // The invoice UI (and the WhatsApp summary below) always does
        // `priceAtTime * quantity` to get the subtotal, so passing the
        // stored total straight through as "priceAtTime" double-counted
        // it — 8kg of rice at ₦2,500/kg (₦20,000 total) rendered as a
        // ₦20,000 *unit* price with a ₦160,000 subtotal. Converting back
        // to a real per-unit figure here keeps both call sites correct
        // without touching how sales are actually recorded.
        ...order.scaleItems.map((item: PrismaScaleOrderItem) => {
          const lineTotal = Number(item.priceAtTime.toString());
          const quantity = Number(item.quantity.toString());
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