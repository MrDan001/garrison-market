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

// Fallback wording for cosmetic prizes when effectSummary (only ever set
// right after a live claim) isn't available — e.g. the person reloads
// the page after already spinning today. Cash/gift kinds don't need a
// fallback here since the Pending/Settled line already covers them.
const KIND_FALLBACK_EFFECT: Record<string, string> = {
  xp_boost: "Added to your XP.",
  badge: "Added to your badges.",
  streak_shield: "Your streak is protected until it's used.",
};

export default function RewardSpinWheel() {
  const [state, setState] = useState<SpinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);
  const [effectSummary, setEffectSummary] = useState<string | null>(null);

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
          setEffectSummary(result.effectSummary ?? null);
          setState({
            available: false,
            claimed: true,
            prizeLabel: result.prizeLabel,
            prizeKind: result.prizeKind ?? null,
            requiresSettlement: !!result.requiresSettlement,
            settled: false,
          });
        } else if (result.prizeLabel) {
          // Blocked but a prize came back — this was already claimed
          // (e.g. two rapid taps, or claimed in another tab). Reflect
          // that instead of leaving the button looking spinnable forever.
          setState({
            available: false,
            claimed: true,
            prizeLabel: result.prizeLabel,
            prizeKind: result.prizeKind ?? null,
            requiresSettlement: !!result.requiresSettlement,
            settled: false,
          });
        }
        // else: genuinely failed with no prior claim to fall back to —
        // button just stops spinning, state unchanged, so the person can
        // simply try again.
      }, 900);
    });
  };

  const displayEffect = effectSummary ?? (state.prizeKind ? KIND_FALLBACK_EFFECT[state.prizeKind] : null);

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
          {displayEffect && <p className="text-xs text-fuchsia-200/70 mt-3">{displayEffect}</p>}
          {state.requiresSettlement && (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              {state.settled ? "Settled by your owner" : "Pending — waiting on your owner"}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-fuchsia-200/70 mb-5">Restock Run complete — you've earned a spin.</p>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSpin}
            aria-label="Spin the wheel"
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