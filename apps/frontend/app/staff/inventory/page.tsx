import { getInventoryForStaff } from "@/lib/business.actions";
import InventoryClient from "./inventory-client";
import { redirect } from "next/navigation";

function sanitize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      // Handles native Prisma Decimal field conversions perfectly
      if (value && typeof value === 'object' && value.constructor.name === 'Decimal') {
        return Number(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    })
  );
}

export default async function InventoryPage() {
  try {
    // 🌟 Catch potential unauthorized exceptions directly from your server action
    const items = await getInventoryForStaff();
    
    // Fallback safely to an empty list collection if data lookup returns empty
    const itemsList = items || [];
    const serializedItems = sanitize(itemsList);
    
    return <InventoryClient initialItems={serializedItems} />;
  } catch (error: any) {
    console.error("Staff inventory rendering error catch block:", error);
    
    // 🌟 Smoothly redirect to login or error screen instead of hitting a white screen/500 error
    if (error.message?.includes("Unauthorized")) {
      redirect("/login?error=session_expired");
    }
    
    // Fallback safe rendering state so the client client view can load
    return <InventoryClient initialItems={[]} />;
  }
}
