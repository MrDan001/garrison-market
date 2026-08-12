// FILE: apps/frontend/app/affiliate/page.tsx

import { getAffiliateSession } from "@/lib/affiliate-auth";
import { getAffiliateDashboardData, getAffiliateEarningsSeries } from "@/lib/affiliate.actions";
import EarningsChart from "./EarningsChart";
import CopyLinkButton from "./CopyLinkButton";

function formatNaira(amount: number): string {
  return `₦${Math.abs(amount).toLocaleString("en-NG")}`;
}

function describeCommission(row: {
  kind: string;
  status: string;
  amountNaira: any;
  monthNumber: number;
  createdAt: Date;
}): { label: string; amountLabel: string; tone: "earn" | "pend" | "reversal" } {
  const amount = Number(row.amountNaira);
  const dateLabel = row.createdAt.toLocaleDateString("en-NG", { month: "short", day: "numeric" });

  if (row.kind === "reversal") {
    return { label: `${dateLabel} · Refund adjustment, month ${row.monthNumber}`, amountLabel: formatNaira(amount), tone: "reversal" };
  }
  if (row.status === "paid") {
    return { label: `${dateLabel} · Month ${row.monthNumber} commission, paid out`, amountLabel: `+${formatNaira(amount)}`, tone: "earn" };
  }
  return { label: `${dateLabel} · Month ${row.monthNumber} commission`, amountLabel: `${formatNaira(amount)} pending`, tone: "pend" };
}

export default async function AffiliateOverviewPage() {
  const affiliate = await getAffiliateSession();
  if (!affiliate) return null; // layout already redirects; this satisfies TS

  const [data, series] = await Promise.all([
    getAffiliateDashboardData(affiliate.id),
    getAffiliateEarningsSeries(affiliate.id),
  ]);

  const maxSeriesValue = Math.max(...series.map((m) => m.total), 1);

  return (
    <div className="pt-6 space-y-4">
      {/* Referral link strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-1" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            Your referral link
          </div>
          <div className="font-mono text-sm sm:text-base font-medium">
            gmstock.co/ref/{affiliate.referralCode}
          </div>
        </div>
        <CopyLinkButton code={affiliate.referralCode!} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl bg-[var(--text-primary)] text-[var(--bg-app)] p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-60 font-bold">Total earned</div>
          <div className="font-mono font-bold text-3xl mt-1.5 tracking-tight">{formatNaira(data.totalEarned)}</div>
          <div className="text-xs opacity-75 mt-1.5">All-time</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold">This month</div>
          <div className="font-mono font-bold text-3xl mt-1.5 tracking-tight">{formatNaira(data.thisMonth)}</div>
          <div className={`text-xs mt-1.5 font-medium ${data.monthOverMonthPct !== null && data.monthOverMonthPct >= 0 ? "text-[#1F6D4C]" : "opacity-60"}`}>
            {data.monthOverMonthPct === null ? "No data last month" : `${data.monthOverMonthPct >= 0 ? "▲" : "▼"} ${Math.abs(data.monthOverMonthPct)}% vs last month`}
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold">Active referrals</div>
          <div className="font-mono font-bold text-3xl mt-1.5 tracking-tight">{data.activeReferralCount}</div>
          <div className="text-xs opacity-60 mt-1.5">Paying monthly</div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
        <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-3">Earnings — last 6 months</div>
        <EarningsChart series={series} maxValue={maxSeriesValue} />
      </div>

      {/* Click stats + receipt feed */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-3.5 items-start">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-3">Promote — link stats</div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between border-b border-dashed border-[var(--border-subtle)]/15 pb-2.5">
              <span className="opacity-60">Total clicks</span>
              <span className="font-mono font-semibold">{data.clickCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-[var(--border-subtle)]/15 pb-2.5">
              <span className="opacity-60">Signups</span>
              <span className="font-mono font-semibold">{data.signupCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">Conversion</span>
              <span className="font-mono font-semibold">{data.conversionPct}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 overflow-hidden">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold px-5 pt-4 pb-3">Recent activity</div>
          {data.recentCommissions.length === 0 ? (
            <div className="px-5 pb-5 text-sm opacity-50">
              No commission yet — share your link to get your first referral.
            </div>
          ) : (
            <div className="font-mono text-xs">
              {data.recentCommissions.map((row) => {
                const { label, amountLabel, tone } = describeCommission(row);
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 border-t border-dashed border-[var(--border-subtle)]/20"
                  >
                    <span className="opacity-60">{label}</span>
                    <span
                      className={`font-bold whitespace-nowrap ${
                        tone === "earn" ? "text-[#1F6D4C]" : tone === "pend" ? "text-[#B5762A]" : "text-[#E55345]"
                      }`}
                    >
                      {amountLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}