import { getStaffOrderHistory } from "@/lib/business.actions";
import OrderHistoryClient from "./order-history-client";

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

export default async function OrdersPage() {
  const orders = await getStaffOrderHistory();
  const serializedOrders = sanitize(orders);

  return <OrderHistoryClient orders={serializedOrders} />;
}