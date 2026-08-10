// FILE: apps/frontend/components/RushWorldView.tsx (UPDATED — Stage 5 adds RewardSpinWheel, WeeklyLeaderboard, and StoreComparison, replacing the old "on the way" placeholder. Storefront / level / streak / Sales Sprint / Restock Run sections unchanged from Stage 4.)

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import type { RushDisplayStats } from "@/lib/rush.actions";
import type { SalesSprintState } from "@/lib/rush-quests.actions";
import type { ShopHealthState } from "@/lib/rush-shop-health.actions";
import type { LeaderboardEntry, StoreComparisonEntry } from "@/lib/rush-leaderboard.actions";
import RestockRunCard from "./RestockRunCard";
import ShopStorefront from "./ShopStoreFront";
import RewardSpinWheel from "./RewardSpinWheel";
import WeeklyLeaderboard from "./WeeklyLeaderboard";
import StoreComparison from "./StoreComparison";

type RushWorldViewProps = RushDisplayStats & {
  backHref: string;
  salesSprint: SalesSprintState | null;
  shopHealth: ShopHealthState | null;
  leaderboard: LeaderboardEntry[];
  storeComparison: StoreComparisonEntry[] | null;
};

export default function RushWorldView({
  backHref,
  displayName,
  level,
  totalXp,
  xpIntoLevel,
  xpForNextLevel,
  percentToNextLevel,
  currentStreak,
  longestStreak,
  isMaxLevel,
  salesSprint,
  shopHealth,
  leaderboard,
  storeComparison,
}: RushWorldViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0b26] via-[#1e1b4b] to-[#0f0b26] text-white">
      <header className="sticky top-0 z-10 bg-[#0f0b26]/70 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4 flex items-center gap-3">
        <Link href={backHref} className="flex items-center gap-1.5 text-xs font-semibold text-fuchsia-200 hover:text-white transition-colors">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300 mb-2">Your shop's world</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold">
            {displayName} <span className="text-fuchsia-300">Rush</span>
          </h1>
        </div>

        {/* Shop Tycoon storefront */}
        <div>
          <ShopStorefront tier={shopHealth?.tier ?? 1} displayName={displayName} />
          {shopHealth && (
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm font-semibold text-fuchsia-200">{shopHealth.tierLabel}</p>
              <p className="text-xs text-fuchsia-200/60">Shop health: {shopHealth.score}/100</p>
            </div>
          )}
        </div>

        {/* Level */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-fuchsia-200 font-semibold uppercase tracking-wider">Level</p>
              <p className="text-4xl font-extrabold">{level}</p>
            </div>
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-fuchsia-300 via-purple-400 to-indigo-700 flex items-center justify-center text-3xl">
              ⭐
            </div>
          </div>

          {isMaxLevel ? (
            <p className="text-sm text-fuchsia-200 font-semibold">You've hit the max level for now — more to come soon 👀</p>
          ) : (
            <>
              <div className="flex justify-between text-[11px] text-fuchsia-200 font-semibold mb-1.5">
                <span>{xpIntoLevel} XP</span>
                <span>{xpForNextLevel} XP to Level {level + 1}</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-300 to-purple-300"
                  style={{ width: `${percentToNextLevel}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Streaks */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-3xl mb-1">🔥</p>
            <p className="text-2xl font-extrabold">{currentStreak}</p>
            <p className="text-[11px] text-fuchsia-200 uppercase tracking-wider mt-1">Day streak</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-3xl mb-1">🏆</p>
            <p className="text-2xl font-extrabold">{longestStreak}</p>
            <p className="text-[11px] text-fuchsia-200 uppercase tracking-wider mt-1">Best streak</p>
          </div>
        </div>

        {/* Sales Sprint */}
        {salesSprint && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap size={16} className="text-fuchsia-300" /> Sales Sprint
              </h2>
              {salesSprint.isRecordPace && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
                  Record pace 🔥
                </span>
              )}
            </div>
            <p className="text-xs text-fuchsia-200/70 mb-4">
              ₦{salesSprint.todayTotal.toLocaleString()} today vs ₦{salesSprint.target.toLocaleString()}
              {salesSprint.yesterdayTotal > 0 ? " yesterday" : " target"}
            </p>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-fuchsia-300 transition-all"
                style={{ width: `${salesSprint.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Restock Run */}
        <RestockRunCard />

        {/* Reward spin — only renders itself if there's something to show */}
        <RewardSpinWheel />

        {/* Weekly leaderboard — only renders if there's activity to rank */}
        <WeeklyLeaderboard entries={leaderboard} />

        {/* Store vs store — owners with 2+ stores only */}
        {storeComparison && <StoreComparison entries={storeComparison} />}

        {shopHealth && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs font-bold text-fuchsia-200 uppercase tracking-wider mb-4">What's shaping your shop's health</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-extrabold">{shopHealth.breakdown.stockHealth}%</p>
                <p className="text-[10px] text-fuchsia-200/60 uppercase tracking-wider mt-1">Stock</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{shopHealth.breakdown.salesTrend}%</p>
                <p className="text-[10px] text-fuchsia-200/60 uppercase tracking-wider mt-1">Sales trend</p>
              </div>
              <div>
                <p className="text-lg font-extrabold">{shopHealth.breakdown.staffActivity}%</p>
                <p className="text-[10px] text-fuchsia-200/60 uppercase tracking-wider mt-1">Staff active</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-fuchsia-200/50 text-center">{totalXp.toLocaleString()} total XP earned</p>
      </main>
    </div>
  );
}