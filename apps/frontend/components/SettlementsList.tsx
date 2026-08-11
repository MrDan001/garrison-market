// FILE: apps/frontend/components/SettlementsList.tsx (NEW FILE — Fix C4)

"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Clock, Wallet } from "lucide-react";
import { listSettlements, markSettled, type SettlementEntry } from "@/lib/rush-settlements.actions";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function SettlementsList() {
  const [entries, setEntries] = useState<SettlementEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await listSettlements();
    setEntries(result);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleSettle(id: number) {
    setSettlingId(id);
    setError(null);
    startTransition(async () => {
      const result = await markSettled(id);
      if (!result.success) {
        setError("Couldn't mark that as settled — please try again.");
      }
      await refresh();
      setSettlingId(null);
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-4" />
        <div className="h-16 w-full bg-white/10 rounded-xl mb-3" />
        <div className="h-16 w-full bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (!entries) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-sm text-fuchsia-200/70">
        Couldn't load settlements.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
        <Wallet size={22} className="mx-auto text-fuchsia-300/60 mb-2" />
        <p className="text-sm text-fuchsia-200/70">No cash or gift prizes won yet.</p>
      </div>
    );
  }

  const pending = entries.filter((e) => !e.settled);
  const settled = entries.filter((e) => e.settled);

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-2.5">{error}</p>
      )}

      <div>
        <h2 className="text-xs font-bold text-fuchsia-200 uppercase tracking-wider mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-fuchsia-200/60">Nothing waiting on you right now.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{entry.staffName}</p>
                  <p className="text-[11px] text-fuchsia-200/70">
                    {entry.prizeLabel} · won {formatDate(entry.wonAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending && settlingId === entry.id}
                  onClick={() => handleSettle(entry.id)}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  {isPending && settlingId === entry.id ? "Settling…" : "Mark Settled"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {settled.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-fuchsia-200 uppercase tracking-wider mb-3">Settled</h2>
          <div className="space-y-2">
            {settled.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 opacity-70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{entry.staffName}</p>
                  <p className="text-[11px] text-fuchsia-200/60">
                    {entry.prizeLabel} · won {formatDate(entry.wonAt)}
                  </p>
                </div>
                <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Clock size={12} /> Settled {entry.settledAt ? formatDate(entry.settledAt) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}