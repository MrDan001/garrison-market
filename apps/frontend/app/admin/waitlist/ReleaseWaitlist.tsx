// FILE: apps/frontend/app/admin/waitlist/ReleaseWaitlist.tsx (NEW FILE)
//
// Deliberately its own button, separate from GateToggle. Flipping the
// gate open/closed never sends an email; this is the only thing that
// does, and only when clicked on purpose. Blocked server-side
// (releaseWaitlistAction) if the gate is still closed, but this
// component surfaces that clearly up front too rather than letting the
// admin discover it only after clicking through.

"use client";

import { useState } from "react";
import { releaseWaitlistAction } from "@/lib/waitlist.actions";

export default function ReleaseWaitlist({
  pendingCount,
  registrationOpen,
}: {
  pendingCount: number;
  registrationOpen: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ released: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRelease() {
    setSending(true);
    setError(null);
    const res = await releaseWaitlistAction();
    setSending(false);
    setConfirming(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult({ released: res.released!, failed: res.failed! });
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60 mb-1">
            Release the waitlist
          </div>
          <p className="text-xs text-[var(--text-primary)]/50">
            {pendingCount.toLocaleString()} people still waiting to be invited.
          </p>
        </div>
        {!confirming && (
          <button
            onClick={() => setConfirming(true)}
            disabled={pendingCount === 0}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#F1EEE3] text-[#0D1527] hover:bg-[#E55345] hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Release waitlist
          </button>
        )}
      </div>

      {!registrationOpen && (
        <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          Registration is still closed. Open the gate above first — invite links won't work until then.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {result && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
          Invited {result.released.toLocaleString()} people{result.failed > 0 ? ` (${result.failed} failed — still marked waiting, safe to retry)` : ""}.
        </div>
      )}

      {confirming && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-primary)]/60">
            This will email all {pendingCount.toLocaleString()} people a working registration link right now. Send?
          </span>
          <button
            onClick={handleRelease}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E55345] text-white hover:bg-[#c94337] transition disabled:opacity-50"
          >
            {sending ? "Sending..." : "Confirm release"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}