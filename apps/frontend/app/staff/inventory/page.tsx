// app/staff/inventory/page.tsx
import { getInventoryForStaff } from "@/lib/business.actions";
import { getScaleInventoryForStaff } from "@/lib/scale-inventory.actions";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveStore } from "@/lib/store-context";
import InventoryClient from "./inventory-client";
import ScaleInventoryClient from "./scale-inventory-client";

function sanitize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") {
        return Number(value);
      }
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );
}

export default async function InventoryPage() {
  try {
    const session = await getSessionUser();
    if (!session) redirect("/login");

    // Get the staff member's owner to read discountEnabled
    const staffUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: {
        ownerId: true,
        owner: { select: { discountEnabled: true } },
      },
    });

    const discountEnabled = staffUser?.owner?.discountEnabled ?? false;

    // storeType (chosen permanently at store creation) decides which
    // inventory system this staff member's assigned store runs on.
    const activeStore = await getActiveStore();

    if (activeStore?.storeType === "scale") {
      const scaleItems = await getScaleInventoryForStaff();
      return (
        <ScaleInventoryClient
          initialItems={sanitize(scaleItems || [])}
          discountEnabled={discountEnabled}
        />
      );
    }

    const items = await getInventoryForStaff();
    const serializedItems = sanitize(items || []);

    return (
      <InventoryClient
        initialItems={serializedItems}
        discountEnabled={discountEnabled}
      />
    );
  } catch (error: any) {
    console.error("Staff inventory error:", error);
    if (error.message?.includes("Unauthorized")) {
      redirect("/login?error=session_expired");
    }
    return <InventoryClient initialItems={[]} discountEnabled={false} />;
  }
}