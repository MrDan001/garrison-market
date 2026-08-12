// FILE: apps/frontend/app/affiliate/referrals/page.tsx

import { getAffiliateSession } from "@/lib/affiliate-auth";
import { getAffiliateReferrals } from "@/lib/affiliate.actions";

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "active") return { label: "Active", cls: "bg-[#E7F1EB] text-[#1F6D4C]" };
  if (s === "trialing") return { label: "Trial", cls: "bg-[#F5E9D8] text-[#B5762A]" };
  if (s === "cancelled" || s === "canceled") return { label: "Cancelled", cls: "bg-[#FBE9E7] text-[#E55345]" };
  return { label: status || "—", cls: "bg-[var(--bg-app)] opacity-60" };
}

export default async function AffiliateReferralsPage() {
  const affiliate = await getAffiliateSession();
  if (!affiliate) return null;

  const referrals = await getAffiliateReferrals(affiliate.id);

  return (
    <div className="pt-6">
      <h1 className="text-lg font-bold mb-1">Your referrals</h1>
      <p className="text-sm opacity-60 mb-5">Every shop that signed up through your link.</p>

      {referrals.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-8 text-center text-sm opacity-60">
          No referrals yet — share your link from the Promote tab to get started.
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 overflow-hidden">
          {/* Header row — desktop/tablet only, the mobile cards below carry their own labels */}
          <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 px-5 py-3 text-[10px] uppercase tracking-widest opacity-50 font-bold border-b border-[var(--border-subtle)]/15">
            <span>Shop</span>
            <span>Status</span>
            <span>Joined</span>
            <span className="text-right">Earned</span>
          </div>
          {referrals.map((r) => {
            const badge = statusBadge(r.subscriptionStatus);
            return (
              <div key={r.id} className="border-b border-[var(--border-subtle)]/10 last:border-b-0">
                {/* Mobile: stacked card */}
                <div className="sm:hidden px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.storeName || "Unnamed shop"}</div>
                      <div className="text-xs opacity-50 font-mono truncate">{r.email}</div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="opacity-50">
                      Joined {r.affiliateReferredAt?.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) || "—"}
                    </span>
                    <span className="font-mono font-semibold text-sm">{formatNaira(r.commissionEarned)}</span>
                  </div>
                </div>

                {/* Tablet/desktop: table row */}
                <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 px-5 py-3.5 items-center text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.storeName || "Unnamed shop"}</div>
                    <div className="text-xs opacity-50 font-mono truncate">{r.email}</div>
                  </div>
                  <span className={`inline-block w-fit px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs opacity-70">
                    {r.affiliateReferredAt?.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) || "—"}
                  </span>
                  <span className="text-right font-mono font-semibold">{formatNaira(r.commissionEarned)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}