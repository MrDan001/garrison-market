// FILE: apps/frontend/app/affiliate/promote/page.tsx

import { getAffiliateSession } from "@/lib/affiliate-auth";
import { getAffiliateDashboardData } from "@/lib/affiliate.actions";
import CopyLinkButton from "../CopyLinkButton";
import QRCodeCard from "./QRCodeCard";

export default async function AffiliatePromotePage() {
  const affiliate = await getAffiliateSession();
  if (!affiliate) return null;

  const data = await getAffiliateDashboardData(affiliate.id);
  const link = `https://gmstock.co/ref/${affiliate.referralCode}`;

  return (
    <div className="pt-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold mb-1">Promote</h1>
        <p className="text-sm opacity-60">Your link, your code, and your QR — everything you need to bring shops in.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-2">Your referral link</div>
          <div className="font-mono text-sm break-all mb-3">{link}</div>
          <CopyLinkButton code={affiliate.referralCode!} />
        </div>

        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
          <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-2">Your referral code</div>
          <div className="font-mono text-2xl font-bold mb-1">{affiliate.referralCode}</div>
          <p className="text-xs opacity-50">For offline sign-ups — a shop owner can type this in at registration instead of using the link.</p>
        </div>
      </div>

      <QRCodeCard link={link} />

      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5">
        <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-3">Link stats</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-mono font-bold text-2xl">{data.clickCount}</div>
            <div className="text-xs opacity-50 mt-1">Total clicks</div>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl">{data.signupCount}</div>
            <div className="text-xs opacity-50 mt-1">Signups</div>
          </div>
          <div>
            <div className="font-mono font-bold text-2xl">{data.conversionPct}%</div>
            <div className="text-xs opacity-50 mt-1">Conversion</div>
          </div>
        </div>
      </div>
    </div>
  );
}