// FILE: apps/frontend/components/RestockRunCard.tsx (NEW FILE)
//
// Client component since it needs tap interactions. Fetches its own data
// on mount rather than requiring the parent server component to thread
// props through — keeps RushWorldView's prop list from growing every
// time a new quest is added.

"use client";

import { useEffect, useState, useTransition } from "react";
import { PackageCheck, Check } from "lucide-react";
import {
  getRestockRunState,
  getRestockRunItems,
  verifyRestockItem,
  type RestockRunState,
  type RestockRunItem,
} from "@/lib/rush-quests.actions";

export default function RestockRunCard() {
  const [state, setState] = useState<RestockRunState | null>(null);
  const [items, setItems] = useState<RestockRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [questState, questItems] = await Promise.all([getRestockRunState(), getRestockRunItems()]);
      if (!cancelled) {
        setState(questState);
        setItems(questItems);
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
        <div className="h-2 w-full bg-white/10 rounded" />
      </div>
    );
  }

  // No resolvable Rush profile/store — quietly render nothing rather than
  // a broken quest card.
  if (!state) return null;

  const handleVerify = (item: RestockRunItem) => {
    setPendingKey(item.key);
    startTransition(async () => {
      const result = await verifyRestockItem(item.id, item.kind);
      if (result.success) {
        const [freshState] = await Promise.all([getRestockRunState()]);
        setState(freshState);
      }
      setPendingKey(null);
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <PackageCheck size={16} className="text-fuchsia-300" /> Restock Run
        </h2>
        <span className="text-xs font-semibold text-fuchsia-200">
          {state.progress}/{state.target}
        </span>
      </div>
      <p className="text-xs text-fuchsia-200/70 mb-4">Verify today's stock counts to earn XP.</p>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-300 to-purple-300 transition-all"
          style={{ width: `${Math.min(100, Math.round((state.progress / state.target) * 100))}%` }}
        />
      </div>

      {state.completed ? (
        <p className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
          <Check size={16} /> Restock Run complete for today. Nice work.
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-fuchsia-200/60">No inventory items to verify right now.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isVerified = state.verifiedInventoryIds.includes(item.key);
            const isRowPending = isPending && pendingKey === item.key;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-[11px] text-fuchsia-200/60">
                    {item.quantity}{item.unit ? ` ${item.unit}` : ""} in stock
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isVerified || isRowPending}
                  onClick={() => handleVerify(item)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    isVerified
                      ? "bg-emerald-500/15 text-emerald-300 cursor-default"
                      : "bg-fuchsia-300/15 text-fuchsia-200 hover:bg-fuchsia-300/25"
                  }`}
                >
                  {isVerified ? "Verified ✓" : isRowPending ? "…" : "Verify"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
