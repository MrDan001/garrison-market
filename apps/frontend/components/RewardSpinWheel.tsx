// FILE: apps/frontend/components/RewardSpinWheel.tsx (REWRITTEN — real segmented wheel instead of a plain spin button. Segments come from getSpinWheelPrizes() (same order the server draws from), and the wheel's final rotation is computed from the actual prizeOptionId the server returns, so the wheel always visually lands on the slice that was really won — never a random-looking mismatch.)

"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getSpinAvailability, getSpinWheelPrizes, claimSpin, type SpinState, type WheelPrize } from "@/lib/rush-rewards.actions";

const SEGMENT_COLORS = ["#8a1414", "#c8860a"]; // deep red / gold, alternating
const SPIN_TURNS = 6; // full rotations before landing, purely visual
const SPIN_DURATION_MS = 3600;
const LIGHT_COUNT = 20;

// Fallback wording for cosmetic prizes when effectSummary (only ever set
// right after a live claim) isn't available — e.g. the person reloads
// the page after already spinning today. Cash/gift kinds don't need a
// fallback here since the Pending/Settled line already covers them.
const KIND_FALLBACK_EFFECT: Record<string, string> = {
  xp_boost: "Added to your XP.",
  badge: "Added to your badges.",
  streak_shield: "Your streak is protected until it's used.",
};

// Wheel labels have limited room — strip a purely-decorative leading
// emoji (if the first "word" has no letter/digit/currency in it, it's
// decoration, not content) and cap the length so long custom prize names
// don't overflow their slice. The full label is still shown untruncated
// in the reveal text below the wheel.
function shortenLabel(label: string): string {
  const withoutLeadingEmoji = label.replace(/^\S+\s+/, (match) => (/[a-zA-Z0-9₦]/.test(match) ? match : ""));
  const text = withoutLeadingEmoji.trim() || label;
  return text.length > 14 ? `${text.slice(0, 13)}…` : text;
}

function computeLandingRotation(targetIndex: number, segmentAngle: number, withExtraSpins: boolean): number {
  const targetMidAngle = targetIndex * segmentAngle + segmentAngle / 2;
  const base = ((360 - targetMidAngle) % 360 + 360) % 360;
  return withExtraSpins ? SPIN_TURNS * 360 + base : base;
}

export default function RewardSpinWheel() {
  const [state, setState] = useState<SpinState | null>(null);
  const [prizes, setPrizes] = useState<WheelPrize[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [effectSummary, setEffectSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [spinState, wheelPrizes] = await Promise.all([getSpinAvailability(), getSpinWheelPrizes()]);
      if (cancelled) return;

      setState(spinState);
      setPrizes(wheelPrizes);

      // If a spin was already claimed earlier today (e.g. page reload),
      // park the wheel on the actual won segment with no animation —
      // only possible if that prize is still in the current active pool
      // (it may have since been edited/deleted by the owner).
      if (spinState?.claimed && spinState.prizeOptionId && wheelPrizes && wheelPrizes.length > 0) {
        const idx = wheelPrizes.findIndex((p) => p.id === spinState.prizeOptionId);
        if (idx >= 0) {
          setRotation(computeLandingRotation(idx, 360 / wheelPrizes.length, false));
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !state) return null;
  // Nothing to show if there's no unclaimed spin and nothing was won
  // today either — keeps the world screen from showing a dead wheel.
  if (!state.available && !state.claimed) return null;

  const segmentCount = prizes?.length ?? 0;
  const segmentAngle = segmentCount > 0 ? 360 / segmentCount : 0;

  const canSpin = state.available && !state.claimed && !spinning && segmentCount > 0;

  const handleSpin = () => {
    if (!canSpin || !prizes) return;
    setSpinning(true);
    setError(null);

    (async () => {
      const result = await claimSpin();

      const wonId = result.prizeOptionId;
      const targetIndex = wonId ? prizes.findIndex((p) => p.id === wonId) : -1;

      if (targetIndex >= 0) {
        setRotation((prev) => prev + computeLandingRotation(targetIndex, segmentAngle, true));
      } else if (result.prizeLabel) {
        // Won something, but it's not in our currently-loaded segment
        // list (rare: pool changed mid-spin). Still land somewhere
        // rather than leaving the wheel frozen mid-spin forever.
        setRotation((prev) => prev + SPIN_TURNS * 360);
      }

      window.setTimeout(() => {
        setSpinning(false);

        if (result.prizeLabel) {
          setEffectSummary(result.effectSummary ?? null);
          setState({
            available: false,
            claimed: true,
            prizeLabel: result.prizeLabel,
            prizeKind: result.prizeKind ?? null,
            prizeOptionId: wonId ?? null,
            requiresSettlement: !!result.requiresSettlement,
            settled: false,
          });
        } else {
          setError("Couldn't spin right now — please try again.");
        }
      }, SPIN_DURATION_MS);
    })();
  };

  const displayEffect = effectSummary ?? (state.prizeKind ? KIND_FALLBACK_EFFECT[state.prizeKind] : null);

  const wheelBackground =
    segmentCount > 0
      ? `conic-gradient(${prizes!
          .map((_, i) => `${SEGMENT_COLORS[i % 2]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
          .join(", ")})`
      : SEGMENT_COLORS[0];

  return (
    <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 p-6 sm:p-8 text-center">
      <h2 className="text-sm font-bold text-white flex items-center justify-center gap-2 mb-4">
        <Sparkles size={16} className="text-fuchsia-300" /> Today's Spin
      </h2>

      {segmentCount === 0 ? (
        <p className="text-xs text-fuchsia-200/70">No prizes are on the wheel right now.</p>
      ) : (
        <div className="relative mx-auto w-72 h-72 sm:w-[22rem] sm:h-[22rem]">
          {/* Static outer ring + rim lights — doesn't rotate */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-red-950 via-red-900 to-black shadow-[0_0_40px_rgba(220,38,38,0.35)]">
            {Array.from({ length: LIGHT_COUNT }).map((_, i) => (
              <div
                key={i}
                className="absolute inset-0 flex items-start justify-center"
                style={{ transform: `rotate(${(360 / LIGHT_COUNT) * i}deg)` }}
              >
                <div className="mt-1 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-300 shadow-[0_0_6px_2px_rgba(252,211,77,0.75)]" />
              </div>
            ))}
          </div>

          {/* Rotating wheel */}
          <div
            className="absolute rounded-full overflow-hidden border-4 border-amber-300/90"
            style={{
              inset: "9%",
              background: wheelBackground,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.65, 0.1, 1)` : "none",
            }}
          >
            {prizes!.map((prize, i) => {
              const midAngle = i * segmentAngle + segmentAngle / 2;
              return (
                <div
                  key={prize.id}
                  className="absolute inset-0 flex justify-center items-start"
                  style={{ transform: `rotate(${midAngle}deg)` }}
                >
                  <span
                    className="mt-5 sm:mt-7 text-[9px] sm:text-[11px] font-extrabold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] text-center leading-tight"
                    style={{ maxWidth: "56px" }}
                  >
                    {shortenLabel(prize.label)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Center hub / spin trigger */}
          <button
            type="button"
            disabled={!canSpin}
            onClick={handleSpin}
            aria-label="Spin the wheel"
            className="absolute inset-0 m-auto h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-2 border-amber-100 shadow-lg z-20 flex items-center justify-center transition-transform disabled:opacity-90 disabled:cursor-default enabled:hover:scale-105"
          >
            <Sparkles size={22} className="text-red-900" />
          </button>

          {/* Pointer */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-30"
            style={{ top: "-2px" }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "11px solid transparent",
                borderRight: "11px solid transparent",
                borderTop: "20px solid #facc15",
                filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.5))",
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-5">
        {state.claimed ? (
          <>
            <p className="text-xs text-fuchsia-200/70 mb-2">
              {spinning ? "Spinning…" : "You already spun today — here's what you got:"}
            </p>
            {!spinning && (
              <>
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
            )}
          </>
        ) : (
          <p className="text-xs font-semibold text-fuchsia-200">
            {spinning ? "Spinning…" : segmentCount > 0 ? "Tap the wheel to spin" : ""}
          </p>
        )}
        {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      </div>
    </div>
  );
}