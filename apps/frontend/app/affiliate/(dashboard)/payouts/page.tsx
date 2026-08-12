// FILE: apps/frontend/app/affiliate/payouts/page.tsx

import { getAffiliateSession } from "@/lib/affiliate-auth";
import { getAffiliatePayoutData } from "@/lib/affiliate.actions";
import RequestPayoutButton from "./RequestPayoutButton";

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function statusStyle(status: string) {
  if (status === "paid") return "bg-[#E7F1EB] text-[#1F6D4C]";
  if (status === "rejected") return "bg-[#FBE9E7] text-[#E55345]";
  return "bg-[#F5E9D8] text-[#B5762A]"; // requested / approved
}

export default async function AffiliatePayoutsPage() {
  const affiliate = await getAffiliateSession();
  if (!affiliate) return null;

  const data = await getAffiliatePayoutData(affiliate.id);

  return (
    <div className="pt-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold mb-1">Payouts</h1>
        <p className="text-sm opacity-60">Minimum payout is ₦5,000 — expect it within a few business days of approval.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl bg-[var(--text-primary)] text-[var(--bg-app)] p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-60 font-bold">Available</div>
          <div className="font-mono font-bold text-2xl mt-1.5">{formatNaira(data.available)}</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold">Total paid out</div>
          <div className="font-mono font-bold text-2xl mt-1.5">{formatNaira(data.totalPaid)}</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5 flex flex-col justify-between">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-2">Request payout</div>
          <RequestPayoutButton
            affiliateId={affiliate.id}
            available={data.available}
            hasPendingRequest={!!data.pendingRequest}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 overflow-hidden">
        <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold px-5 pt-4 pb-3">Payout history</div>
        {data.payouts.length === 0 ? (
          <div className="px-5 pb-5 text-sm opacity-50">No payout requests yet.</div>
        ) : (
          data.payouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[var(--border-subtle)]/10 text-sm"
            >
              <div>
                <div className="font-mono font-semibold">{formatNaira(Number(p.amountNaira))}</div>
                <div className="text-xs opacity-50">
                  {p.requestedAt.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                  {p.bankAccountNumber ? ` · Bank ****${p.bankAccountNumber.slice(-4)}` : ""}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${statusStyle(p.status)}`}>
                {p.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}