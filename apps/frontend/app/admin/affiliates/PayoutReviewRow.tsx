// FILE: apps/frontend/app/admin/affiliates/PayoutReviewRow.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markPayoutPaidAction, rejectPayoutAction } from "@/lib/affiliate.actions";

export default function PayoutReviewRow({
  payoutId,
  affiliateName,
  affiliateEmail,
  amountLabel,
  bankLabel,
  requestedAtLabel,
  adminEmail,
}: {
  payoutId: number;
  affiliateName: string;
  affiliateEmail: string;
  amountLabel: string;
  bankLabel: string;
  requestedAtLabel: string;
  adminEmail: string;
}) {
  const [loading, setLoading] = useState<"paid" | "rejected" | null>(null);
  const router = useRouter();

  async function handleMarkPaid() {
    setLoading("paid");
    await markPayoutPaidAction(payoutId, adminEmail);
    setLoading(null);
    router.refresh();
  }

  async function handleReject() {
    const note = prompt("Reason for rejecting this payout?") || "";
    setLoading("rejected");
    await rejectPayoutAction(payoutId, adminEmail, note);
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200/10 flex-wrap">
      <div>
        <div className="font-semibold text-[var(--text-primary)] text-sm">{affiliateName}</div>
        <div className="text-xs text-slate-500">{affiliateEmail}</div>
        <div className="text-xs text-slate-500 font-mono mt-1">{bankLabel}</div>
        <div className="text-[11px] text-slate-500 mt-1">Requested {requestedAtLabel}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-[var(--text-primary)]">{amountLabel}</span>
        <button
          onClick={handleMarkPaid}
          disabled={loading !== null}
          className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
        >
          {loading === "paid" ? "Marking..." : "Mark paid"}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
        >
          {loading === "rejected" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}