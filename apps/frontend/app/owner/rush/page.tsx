// FILE: apps/frontend/app/owner/rush/page.tsx (UPDATED — adds getStaffClockRoster(), passed to RushWorldView as staffRoster. Stage 5 additions — getWeeklyLeaderboard(), getStoreComparison() — unchanged.)

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRushDisplayStats } from "@/lib/rush.actions";
import { getSalesSprintState } from "@/lib/rush-quests.actions";
import { getShopHealth } from "@/lib/rush-shop-health.actions";
import { getWeeklyLeaderboard, getStoreComparison } from "@/lib/rush-leaderboard.actions";
import { getPendingSettlementsCount } from "@/lib/rush-settlements.actions";
import { getStaffClockRoster } from "@/lib/rush-clock.actions";
import RushWorldView from "@/components/RushWorldView";

export default async function OwnerRushPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const stats = await getRushDisplayStats();
  if (!stats) redirect("/owner/dashboard");

  const [salesSprint, shopHealth, leaderboard, storeComparison, pendingSettlementsCount, staffRoster] = await Promise.all([
    getSalesSprintState(),
    getShopHealth(),
    getWeeklyLeaderboard(),
    getStoreComparison(),
    getPendingSettlementsCount(),
    getStaffClockRoster(),
  ]);

  return (
    <RushWorldView
      backHref="/owner/dashboard"
      role="owner"
      salesSprint={salesSprint}
      shopHealth={shopHealth}
      leaderboard={leaderboard}
      storeComparison={storeComparison}
      pendingSettlementsCount={pendingSettlementsCount}
      staffRoster={staffRoster}
      {...stats}
    />
  );
}