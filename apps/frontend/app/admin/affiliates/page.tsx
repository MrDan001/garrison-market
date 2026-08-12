// FILE: apps/frontend/app/admin/affiliates/page.tsx

import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAffiliatesForAdmin, listPayoutRequestsForAdmin } from "@/lib/affiliate.actions";
import AffiliateStatusToggle from "./AffiliateStatusToggle";
import PayoutReviewRow from "./PayoutReviewRow";

export const dynamic = "force-dynamic";

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function AdminAffiliatesPage() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    redirect("/login");
  }

  const [affiliates, pendingPayouts] = await Promise.all([
    listAffiliatesForAdmin(),
    listPayoutRequestsForAdmin(),
  ]);

  return (
    <div className="space-y-6">
      {/* Pending payout requests — the thing that needs action first */}
      <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 overflow-hidden">
        <div className="px-5 pt-4 pb-3 text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60">
          Pending payout requests {pendingPayouts.length > 0 && `(${pendingPayouts.length})`}
        </div>
        {pendingPayouts.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-slate-500">Nothing waiting on you right now.</div>
        ) : (
          pendingPayouts.map((p) => (
            <PayoutReviewRow
              key={p.id}
              payoutId={p.id}
              affiliateName={p.affiliate.fullName}
              affiliateEmail={p.affiliate.email}
              amountLabel={formatNaira(Number(p.amountNaira))}
              bankLabel={`${p.bankName || "—"} · ${p.bankAccountNumber || "—"} · ${p.bankAccountName || "—"}`}
              requestedAtLabel={p.requestedAt.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
              adminEmail={session.email}
            />
          ))
        )}
      </div>

      {/* All affiliates */}
      <div className="rounded-2xl bg-[var(--bg-app)]/40 border border-slate-200/10 overflow-hidden">
        <div className="px-5 pt-4 pb-3 text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/60">
          All affiliates ({affiliates.length})
        </div>
        <div className="hidden sm:grid grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-2 px-5 py-2.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-t border-b border-slate-200/10">
          <span>Affiliate</span>
          <span>Code</span>
          <span>Referrals</span>
          <span>Earned</span>
          <span>Status</span>
        </div>
        {affiliates.map((a) => (
          <div key={a.id} className="border-b border-slate-200/5 last:border-b-0">
            {/* Mobile: stacked card */}
            <div className="sm:hidden px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--text-primary)] truncate">{a.fullName}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{a.email}</div>
                </div>
                <AffiliateStatusToggle affiliateId={a.id} status={a.status} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500">{a.referralCode} · {a.referredCount} referrals</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{formatNaira(a.totalEarned)}</span>
              </div>
            </div>

            {/* Tablet/desktop: table row */}
            <div className="hidden sm:grid grid-cols-[1.5fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-2 px-5 py-3.5 items-center text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] truncate">{a.fullName}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{a.email}</div>
              </div>
              <span className="font-mono text-xs">{a.referralCode}</span>
              <span className="font-mono text-xs">{a.referredCount}</span>
              <span className="font-mono text-xs font-semibold">{formatNaira(a.totalEarned)}</span>
              <AffiliateStatusToggle affiliateId={a.id} status={a.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}