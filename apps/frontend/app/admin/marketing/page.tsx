import { redirect } from "next/navigation";
import { requireMarketingAdmin } from "@/lib/marketing/admin";
import MarketingManager from "./MarketingManager";

export const dynamic = "force-dynamic";

export default async function MarketingAdminPage() {
  try {
    await requireMarketingAdmin();
  } catch {
    redirect("/login");
  }

  return <MarketingManager />;
}
