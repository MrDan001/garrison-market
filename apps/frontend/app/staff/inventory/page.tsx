import { getInventoryForStaff } from "@/lib/business.actions";
import InventoryClient from "./inventory-client";

function sanitize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
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
  const items = await getInventoryForStaff() || [];
  const serializedItems = sanitize(items);

  return <InventoryClient initialItems={serializedItems} />;
}