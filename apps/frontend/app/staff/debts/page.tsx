import { getOpenDebtsForStaff } from "@/lib/debt.actions";
import DebtsClient from "./debts-client";

function sanitize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value && typeof value === "object" && value.constructor.name === "Decimal") {
        return Number(value);
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    })
  );
}

export default async function StaffDebtsPage() {
  const debts = await getOpenDebtsForStaff();
  const serializedDebts = sanitize(debts);

  return <DebtsClient debts={serializedDebts} />;
}