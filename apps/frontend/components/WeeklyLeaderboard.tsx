// FILE: apps/frontend/components/WeeklyLeaderboard.tsx (NEW FILE)
//
// Pure presentational — the page fetches getWeeklyLeaderboard() and
// passes the result in. Kept server-rendered (no client fetch) since
// there's no interaction here, just a ranked list.

import type { LeaderboardEntry } from "@/lib/rush-leaderboard.actions";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function WeeklyLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <h2 className="text-sm font-bold text-white mb-1">This Week's Top Performers</h2>
      <p className="text-xs text-fuchsia-200/70 mb-5">Ranked by XP earned in the last 7 days.</p>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
              entry.isCurrentUser
                ? "bg-fuchsia-400/10 border-fuchsia-400/30"
                : "bg-white/[0.03] border-white/10"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg w-6 text-center shrink-0">{MEDAL[entry.rank - 1] ?? `#${entry.rank}`}</span>
              <span className="text-sm font-semibold text-white truncate">
                {entry.name}
                {entry.isCurrentUser && <span className="text-fuchsia-300 font-normal"> (you)</span>}
              </span>
            </div>
            <span className="text-sm font-bold text-fuchsia-200 shrink-0">{entry.xp.toLocaleString()} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}