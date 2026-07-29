// FILE: apps/frontend/app/staff/inventory/page.tsx

// app/staff/inventory/page.tsx
import { getInventoryForStaff } from "@/lib/business.actions";
import { getScaleInventoryForStaff } from "@/lib/scale-inventory.actions";
import { getOpenScaleConsignmentsForStaff, getScaleConsignmentHistoryForStaff } from "@/lib/consignment.actions";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getActiveStore } from "@/lib/store-context";
import InventoryClient from "./inventory-client";
import ScaleInventoryClient from "./scale-inventory-client";
import StaffInventoryModeSwitcher from "./staff-inventory-mode-switcher";
import MergedInventoryClient from "./merged-inventory-client";

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
        owner: { select: { discountEnabled: true, scaleConsignmentEnabled: true, mergedCartEnabled: true } },
      },
    });

    const discountEnabled = staffUser?.owner?.discountEnabled ?? false;
    const scaleConsignmentEnabled = staffUser?.owner?.scaleConsignmentEnabled ?? false;
    const mergedCartEnabled = staffUser?.owner?.mergedCartEnabled ?? false;

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

    // Admin-only override: on an otherwise-untouched standard store, if the
    // owner has scaleConsignmentEnabled on, staff get a List/Scale toggle.
    // List is this same InventoryClient, unchanged. Scale shows only what's
    // been signed out to THIS staff member today via consignment.
    if (scaleConsignmentEnabled) {
      const [openConsignments, history] = await Promise.all([
        getOpenScaleConsignmentsForStaff(),
        getScaleConsignmentHistoryForStaff(),
      ]);

      // Further admin-only override: mergedCartEnabled replaces the
      // List/Scale switcher with one catalog + one cart, so a single sale
      // can hold both standard Inventory items and consignment-signed-out
      // scale items.
      if (mergedCartEnabled) {
        return (
          <MergedInventoryClient
            listItems={serializedItems}
            discountEnabled={discountEnabled}
            scaleOpenConsignments={sanitize(openConsignments || [])}
          />
        );
      }

      return (
        <StaffInventoryModeSwitcher
          listItems={serializedItems}
          discountEnabled={discountEnabled}
          scaleOpenConsignments={sanitize(openConsignments || [])}
          scaleHistory={sanitize(history || [])}
        />
      );
    }

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