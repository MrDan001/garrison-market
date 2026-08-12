// FILE: apps/frontend/app/affiliate/payouts/RequestPayoutButton.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPayoutAction } from "@/lib/affiliate.actions";

export default function RequestPayoutButton({
  affiliateId,
  available,
  hasPendingRequest,
}: {
  affiliateId: number;
  available: number;
  hasPendingRequest: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const disabled = loading || hasPendingRequest || available < 5000;

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await requestPayoutAction(affiliateId);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={disabled}
        className="w-full bg-[var(--text-primary)] text-[var(--bg-app)] px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-85 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {hasPendingRequest ? "Request pending" : loading ? "Requesting..." : "Request payout"}
      </button>
      {error && <p className="text-[11px] text-[#E55345] mt-2">{error}</p>}
      {!hasPendingRequest && available < 5000 && !error && (
        <p className="text-[11px] opacity-40 mt-2">Minimum ₦5,000 to request.</p>
      )}
    </div>
  );
}