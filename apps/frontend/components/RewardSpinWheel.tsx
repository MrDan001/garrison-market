// FILE: apps/frontend/components/RewardSpinWheel.tsx (NEW FILE)
//
// Client component — fetches its own availability on mount, same pattern
// as RestockRunCard. Renders nothing if a spin was never earned today
// and hasn't already been claimed either — an idle wheel with nothing to
// do would just be clutter.

"use client";

import { useEffect, useState, useTransition } from "react";
import { Gift, Sparkles } from "lucide-react";
import { getSpinAvailability, claimSpin, type SpinState } from "@/lib/rush-rewards.actions";

export default function RewardSpinWheel() {
  const [state, setState] = useState<SpinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSpinAvailability();
      if (!cancelled) {
        setState(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !state) return null;
  // Nothing to show if there's no unclaimed spin and nothing was won
  // today either — keeps the world screen from showing a dead wheel.
  if (!state.available && !state.claimed) return null;

  const handleSpin = () => {
    setSpinning(true);
    startTransition(async () => {
      const result = await claimSpin();
      // Small delay so the spin animation has time to play before the
      // prize reveal — purely cosmetic, not load-bearing.
      setTimeout(() => {
        setSpinning(false);
        if (result.success && result.prizeLabel) {
          setState({ available: false, claimed: true, prizeLabel: result.prizeLabel });
        } else {
          setState((prev) => prev); // leave as-is if it failed; button just stops spinning
        }
      }, 900);
    });
  };

  return (
    <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 p-6 sm:p-8 text-center">
      <h2 className="text-sm font-bold text-white flex items-center justify-center gap-2 mb-1">
        <Gift size={16} className="text-fuchsia-300" /> Today's Spin
      </h2>

      {state.claimed ? (
        <>
          <p className="text-xs text-fuchsia-200/70 mb-4">You already spun today — here's what you got:</p>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm font-bold text-white">
            {state.prizeLabel}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-fuchsia-200/70 mb-5">Restock Run complete — you've earned a spin.</p>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSpin}
            className={`mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-fuchsia-300 via-purple-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/50 transition-transform ${
              spinning ? "animate-spin" : "hover:scale-105"
            }`}
          >
            <Sparkles size={28} className="text-white" />
          </button>
          <p className="text-xs font-semibold text-fuchsia-200 mt-4">{spinning ? "Spinning…" : "Tap to spin"}</p>
        </>
      )}
    </div>
  );
}