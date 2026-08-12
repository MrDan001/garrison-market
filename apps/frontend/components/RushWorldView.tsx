// FILE: apps/frontend/components/RushWorldView.tsx (UPDATED — RewardSpinWheel is staff-only now, gated by role instead of rendering unconditionally. Staff Clock-Ins moved off this page: instead of the StaffClockRosterCard rendering inline, there's now a compact button linking to /owner/rush/attendance, same row style as "My Wins". Stage 5 additions — WeeklyLeaderboard, StoreComparison — unchanged.)

import Link from "next/link";
import { ArrowLeft, Zap, ChevronRight, HelpCircle } from "lucide-react";
import type { RushDisplayStats } from "@/lib/rush.actions";
import type { SalesSprintState } from "@/lib/rush-quests.actions";
import type { ShopHealthState } from "@/lib/rush-shop-health.actions";
import type { LeaderboardEntry, StoreComparisonEntry } from "@/lib/rush-leaderboard.actions";
import RestockRunCard from "./RestockRunCard";
import ShopStorefront from "./ShopStoreFront";
import RewardSpinWheel from "./RewardSpinWheel";
import WeeklyLeaderboard from "./WeeklyLeaderboard";
import StoreComparison from "./StoreComparison";
import ClockInOutCard from "./ClockInOutCard";
import type { StaffClockRosterEntry } from "@/lib/rush-clock.actions";

type RushWorldViewProps = RushDisplayStats & {
  backHref: string;
  role: "staff" | "owner";
  salesSprint: SalesSprintState | null;
  shopHealth: ShopHealthState | null;
  leaderboard: LeaderboardEntry[];
  storeComparison: StoreComparisonEntry[] | null;
  // Fix A — staff sees the clock-in card (role gate handled by whether
  // this is passed at all).
  showClockCard?: boolean;
  // Fix B — only passed for staff. When present, salesSprint (store-wide)
  // is shown alongside it as "Store Target" instead of alone as "Sales
  // Sprint." Owner's view is untouched: salesSprint alone, same as before.
  personalSalesSprint?: SalesSprintState | null;
  // Fix C4 — owner only. Count of unsettled cash/gift wins, shown as a
  // badge on the Settlements link so it's noticeable without a click.
  pendingSettlementsCount?: number;
  // Owner only — today's staff clock-in roster. Undefined on the staff
  // page (that role has no business seeing everyone else's clock times).
  staffRoster?: StaffClockRosterEntry[];
};

function SalesSprintCard({ state, title }: { state: SalesSprintState; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap size={16} className="text-fuchsia-300" /> {title}
        </h2>
        {state.isRecordPace && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
            Record pace 🔥
          </span>
        )}
      </div>
      <p className="text-xs text-fuchsia-200/70 mb-4">
        ₦{state.todayTotal.toLocaleString()} today vs ₦{state.target.toLocaleString()}
        {state.yesterdayTotal > 0 ? " yesterday" : " target"}
      </p>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-fuchsia-300 transition-all"
          style={{ width: `${state.percent}%` }}
        />
      </div>
    </div>
  );
}

export default function RushWorldView({
  backHref,
  role,
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
  showClockCard,
  personalSalesSprint,
  pendingSettlementsCount,
  staffRoster,
}: RushWorldViewProps) {
  const onShiftCount = staffRoster?.filter((e) => e.clockedIn && !e.clockedOut).length ?? 0;

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
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold">
              {displayName} <span className="text-fuchsia-300">Rush</span>
            </h1>
            <Link
              href={role === "staff" ? "/staff/rush/guide" : "/owner/rush/guide"}
              className="shrink-0 mt-2 flex items-center gap-1.5 text-xs font-semibold text-fuchsia-200 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors"
            >
              <HelpCircle size={13} /> How to Play
            </Link>
          </div>
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

        {/* Sales Sprint — staff get their own number plus the store target
            side by side; owner keeps just the one store-wide card, exactly
            as before. */}
        {personalSalesSprint && <SalesSprintCard state={personalSalesSprint} title="Your Sales" />}
        {salesSprint && (
          <SalesSprintCard state={salesSprint} title={personalSalesSprint ? "Store Target" : "Sales Sprint"} />
        )}

        {/* Clock in/out — staff only */}
        {showClockCard && <ClockInOutCard />}

        {/* Staff clock roster — owner only. Full list lives on its own
            page now; this is just the entry point, badge shows who's
            currently on shift so it's useful at a glance without a click. */}
        {staffRoster && (
          <Link
            href="/owner/rush/attendance"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-fuchsia-200 hover:bg-white/[0.06] transition-colors"
          >
            <span className="flex items-center gap-2">
              Staff Clock-Ins
              {onShiftCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-emerald-400 text-[11px] font-bold text-slate-900">
                  {onShiftCount}
                </span>
              )}
            </span>
            <ChevronRight size={16} />
          </Link>
        )}

        {/* Restock Run */}
        <RestockRunCard />

        {/* Reward spin — staff only. Owner never had a reason to spin their
            own store's prize wheel; self-gating inside the component only
            covered "is there a prize pool," not "should this role see it
            at all," so the role check belongs here instead. */}
        {role === "staff" && <RewardSpinWheel />}

        {/* My Wins — staff only */}
        {showClockCard && (
          <Link
            href="/staff/rush/wins"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-fuchsia-200 hover:bg-white/[0.06] transition-colors"
          >
            My Wins
            <ChevronRight size={16} />
          </Link>
        )}

        {/* Manage spin prizes / settlements — owner only. */}
        {role === "owner" && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/owner/rush/prizes"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm font-semibold text-fuchsia-200 hover:bg-white/[0.06] transition-colors"
            >
              Manage prizes
              <ChevronRight size={16} />
            </Link>
            <Link
              href="/owner/rush/settlements"
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm font-semibold text-fuchsia-200 hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-2">
                Settlements
                {!!pendingSettlementsCount && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-amber-400 text-[11px] font-bold text-slate-900">
                    {pendingSettlementsCount}
                  </span>
                )}
              </span>
              <ChevronRight size={16} />
            </Link>
          </div>
        )}

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