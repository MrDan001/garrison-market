// FILE: apps/frontend/app/owner/rush/page.tsx (UPDATED — Stage 5 adds getWeeklyLeaderboard() and getStoreComparison(), passed to RushWorldView. Everything else unchanged from Stage 4.)

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRushDisplayStats } from "@/lib/rush.actions";
import { getSalesSprintState } from "@/lib/rush-quests.actions";
import { getShopHealth } from "@/lib/rush-shop-health.actions";
import { getWeeklyLeaderboard, getStoreComparison } from "@/lib/rush-leaderboard.actions";
import { getShiftStartTime } from "@/lib/rush-clock.actions";
import { getPendingSettlementsCount } from "@/lib/rush-settlements.actions";
import RushWorldView from "@/components/RushWorldView";

export default async function OwnerRushPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "owner") redirect("/login");

  const stats = await getRushDisplayStats();
  if (!stats) redirect("/owner/dashboard");

  const [salesSprint, shopHealth, leaderboard, storeComparison, shiftStartTime, pendingSettlementsCount] =
    await Promise.all([
      getSalesSprintState(),
      getShopHealth(),
      getWeeklyLeaderboard(),
      getStoreComparison(),
      getShiftStartTime(),
      getPendingSettlementsCount(),
    ]);

  return (
    <RushWorldView
      backHref="/owner/dashboard"
      role="owner"
      salesSprint={salesSprint}
      shopHealth={shopHealth}
      leaderboard={leaderboard}
      storeComparison={storeComparison}
      shiftStartTime={shiftStartTime}
      pendingSettlementsCount={pendingSettlementsCount}
      {...stats}
    />
  );
}