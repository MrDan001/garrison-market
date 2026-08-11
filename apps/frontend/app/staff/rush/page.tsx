// FILE: apps/frontend/app/staff/rush/page.tsx (UPDATED — Stage 5 adds getWeeklyLeaderboard(), passed to RushWorldView. storeComparison is passed as null — that section is owner-only. Everything else unchanged from Stage 4.)

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRushDisplayStats } from "@/lib/rush.actions";
import { getSalesSprintState, getPersonalSalesSprintState } from "@/lib/rush-quests.actions";
import { getShopHealth } from "@/lib/rush-shop-health.actions";
import { getWeeklyLeaderboard } from "@/lib/rush-leaderboard.actions";
import RushWorldView from "@/components/RushWorldView";

export default async function StaffRushPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "staff") redirect("/login");

  const stats = await getRushDisplayStats();
  if (!stats) redirect("/staff/dashboard");

  const [salesSprint, personalSalesSprint, shopHealth, leaderboard] = await Promise.all([
    getSalesSprintState(),
    getPersonalSalesSprintState(),
    getShopHealth(),
    getWeeklyLeaderboard(),
  ]);

  return (
    <RushWorldView
      backHref="/staff/dashboard"
      role="staff"
      salesSprint={salesSprint}
      personalSalesSprint={personalSalesSprint}
      shopHealth={shopHealth}
      leaderboard={leaderboard}
      storeComparison={null}
      showClockCard
      {...stats}
    />
  );
}