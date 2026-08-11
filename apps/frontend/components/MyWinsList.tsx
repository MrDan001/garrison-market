// FILE: apps/frontend/components/MyWinsList.tsx (NEW FILE — Fix C5)
//
// Self-fetching client component, same pattern as ClockInOutCard and
// SettlementsList. Cosmetic wins (badge/xp_boost/streak_shield) show as
// already-applied; cash/gift wins show Pending/Settled.

"use client";

import { useEffect, useState } from "react";
import { Trophy, Clock, CheckCircle2 } from "lucide-react";
import { listMyWins, type MyWinEntry } from "@/lib/rush-wins.actions";

const KIND_APPLIED_TEXT: Record<string, string> = {
  xp_boost: "Added to your XP",
  badge: "Added to your badges",
  streak_shield: "Applied to your streak",
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MyWinsList() {
  const [wins, setWins] = useState<MyWinEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listMyWins();
      if (!cancelled) {
        setWins(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-4" />
        <div className="h-16 w-full bg-white/10 rounded-xl mb-3" />
        <div className="h-16 w-full bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (!wins) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-sm text-fuchsia-200/70">
        Couldn't load your wins.
      </div>
    );
  }

  if (wins.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
        <Trophy size={22} className="mx-auto text-fuchsia-300/60 mb-2" />
        <p className="text-sm text-fuchsia-200/70">No spins yet — finish today's Restock Run to unlock one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {wins.map((win) => (
        <div
          key={win.id}
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            win.requiresSettlement && !win.settled
              ? "border-amber-400/20 bg-amber-500/[0.06]"
              : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{win.prizeLabel}</p>
            <p className="text-[11px] text-fuchsia-200/60">won {formatDate(win.wonAt)}</p>
          </div>

          <div className="shrink-0">
            {win.requiresSettlement ? (
              win.settled ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 size={12} /> Settled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                  <Clock size={12} /> Pending
                </span>
              )
            ) : (
              <span className="text-[11px] text-fuchsia-200/50">
                {KIND_APPLIED_TEXT[win.prizeKind] ?? "Applied"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}