// FILE: apps/frontend/app/admin/waitlist/GateToggle.tsx (NEW FILE)
//
// Flipping this only controls whether /register is reachable — it
// never sends an email (see the separate "Release Waitlist" action in
// a later stage), so it's safe to flip on/off repeatedly while
// testing. A one-step confirm before closing/opening still felt right
// given this affects every visitor to the site, not just one record
// like AffiliateStatusToggle's suspend/reactivate.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleRegistrationGateAction } from "@/lib/system-settings.actions";

export default function GateToggle({ registrationOpen }: { registrationOpen: boolean }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    await toggleRegistrationGateAction(!registrationOpen);
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-primary)]/60">
          {registrationOpen ? "Close registration and send everyone to the waitlist?" : "Reopen registration for everyone?"}
        </span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E55345] text-white hover:bg-[#c94337] transition disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
        registrationOpen
          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
      }`}
      title={registrationOpen ? "Click to close registration" : "Click to reopen registration"}
    >
      {registrationOpen ? "Registration open" : "Registration closed"}
    </button>
  );
}