// FILE: apps/frontend/app/waitlist/WaitlistForm.tsx (NEW FILE)

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, MapPin } from "lucide-react";
import { joinWaitlistAction } from "@/lib/waitlist.actions";
import { NIGERIAN_LOCATIONS } from "@/lib/nigeria-locations";

export default function WaitlistForm({ referredByCode }: { referredByCode: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("");
  const [selectedLga, setSelectedLga] = useState("");
  const router = useRouter();

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedState(e.target.value);
    setSelectedLga("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await joinWaitlistAction(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.referralCode) {
      router.push(`/waitlist/thank-you?ref=${result.referralCode}`);
    }
  }

  const inputClass =
    "w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/35 focus:outline-none focus:border-[#E55345] transition-colors";
  const selectClass =
    "w-full bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] pl-9 pr-8 py-3 rounded-lg border border-[var(--border-subtle)]/15 focus:outline-none focus:border-[#E55345] appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {referredByCode && (
        <input type="hidden" name="ref" value={referredByCode} />
      )}

      <input name="fullName" required placeholder="Full name" className={inputClass} />
      <input name="email" type="email" required placeholder="Email address" className={inputClass} />
      <input name="phone" required placeholder="Phone number" className={inputClass} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30 pointer-events-none z-10" />
          <select name="state" value={selectedState} onChange={handleStateChange} className={selectClass}>
            <option value="">State (optional)</option>
            {Object.keys(NIGERIAN_LOCATIONS).map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-primary)]/30 text-xs">▼</div>
        </div>

        <div className="relative">
          <select
            name="lga"
            value={selectedLga}
            onChange={(e) => setSelectedLga(e.target.value)}
            disabled={!selectedState}
            className={`${selectClass} pl-4`}
          >
            <option value="">LGA</option>
            {selectedState && NIGERIAN_LOCATIONS[selectedState].map((lga) => (
              <option key={lga} value={lga}>{lga}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-primary)]/30 text-xs">▼</div>
        </div>
      </div>

      <input name="sells" placeholder="What do you sell? (optional)" className={inputClass} />

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider bg-[#F1EEE3] text-[#0D1527] px-5 py-3.5 rounded-lg hover:bg-[#E55345] hover:text-[var(--text-primary)] transition-colors disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Joining...
          </>
        ) : (
          <>
            Join the waitlist <ArrowRight size={16} strokeWidth={2.5} />
          </>
        )}
      </button>

      {referredByCode && (
        <p className="text-xs text-[var(--text-primary)]/40 text-center">
          You were referred by a code — they'll move up the line once you join.
        </p>
      )}
    </form>
  );
}