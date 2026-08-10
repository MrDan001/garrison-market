// FILE: apps/frontend/components/RushCard.tsx (NEW FILE)
//
// The one "unavoidably visible" entry point into Rush, meant to sit
// inside the existing dashboard widget stack (owner or staff) as one
// more card — not a redesign of the layout around it. Deliberately
// styled outside the app's normal light/dark palette (a fixed purple/
// indigo gradient) so it always reads as "a doorway to somewhere else,"
// regardless of which theme the rest of the dashboard is in.
//
// Fails silently: if Rush data can't be resolved for any reason, this
// renders nothing rather than a broken card or an error — the real
// dashboard must never be affected by the game layer.

import Link from "next/link";
import { getRushDisplayStats } from "@/lib/rush.actions";

export default async function RushCard({ role }: { role: "owner" | "staff" }) {
  const stats = await getRushDisplayStats();
  if (!stats) return null;

  const {
    displayName,
    level,
    currentStreak,
    percentToNextLevel,
    isMaxLevel,
  } = stats;

  const href = role === "owner" ? "/owner/rush" : "/staff/rush";

  return (
    <Link
      href={href}
      className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 overflow-hidden rounded-2xl border border-fuchsia-400/20 p-6 sm:p-7 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 transition-shadow group"
    >
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />

      <div className="relative z-10 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-fuchsia-300" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">Your shop's world</span>
        </div>

        <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">
          {displayName} <span className="text-fuchsia-300">Rush</span>
        </h3>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100">
            🔥 {currentStreak}-day streak
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100">
            ⭐ Level {level}
          </span>
        </div>

        <div className="mt-4 w-full sm:w-72">
          {isMaxLevel ? (
            <p className="text-[11px] text-fuchsia-200 font-semibold">Max level reached — for now 👀</p>
          ) : (
            <>
              <p className="text-[11px] text-fuchsia-200 font-semibold mb-1.5">
                {percentToNextLevel}% to Level {level + 1}
              </p>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-300 to-purple-300"
                  style={{ width: `${percentToNextLevel}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative z-10 flex sm:flex-col items-center gap-2 shrink-0 self-start sm:self-center">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-fuchsia-300 via-purple-400 to-indigo-700 flex items-center justify-center text-2xl shadow-lg shadow-purple-900/50 group-hover:scale-105 transition-transform">
          {role === "owner" ? "🏪" : "🎮"}
        </div>
        <span className="text-xs font-bold text-fuchsia-200">Enter →</span>
      </div>
    </Link>
  );
}