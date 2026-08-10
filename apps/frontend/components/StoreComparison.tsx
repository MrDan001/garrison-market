// FILE: apps/frontend/components/StoreComparison.tsx (NEW FILE)
//
// Pure presentational — only rendered when the page passes a non-null
// entries array (getStoreComparison() already returns null for owners
// with one store or fewer, so this component doesn't need to duplicate
// that check).

import type { StoreComparisonEntry } from "@/lib/rush-leaderboard.actions";

export default function StoreComparison({ entries }: { entries: StoreComparisonEntry[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <h2 className="text-sm font-bold text-white mb-1">Your Stores, Side by Side</h2>
      <p className="text-xs text-fuchsia-200/70 mb-5">Shop health across every store you run.</p>

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={entry.storeId}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
              entry.isActive ? "bg-fuchsia-400/10 border-fuchsia-400/30" : "bg-white/[0.03] border-white/10"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {index === 0 && "👑 "}
                {entry.storeName}
                {entry.isActive && <span className="text-fuchsia-300 font-normal"> (viewing)</span>}
              </p>
              <p className="text-[11px] text-fuchsia-200/60">{entry.tierLabel}</p>
            </div>
            <span className="text-sm font-bold text-fuchsia-200 shrink-0">{entry.score}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}