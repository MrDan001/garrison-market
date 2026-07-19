"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Lock } from "lucide-react";

interface TrialBannerProps {
  isLocked: boolean;
  subscriptionStatus: string;
  trialDaysLeft: number | null;
  isOwner: boolean;
}

/**
 * Shows at the top of owner/staff dashboards. Staff see a read-only version
 * (no "upgrade" button, since only owners manage billing) telling them the
 * store is frozen until their owner pays.
 */
export function TrialBanner({ isLocked, subscriptionStatus, trialDaysLeft, isOwner }: TrialBannerProps) {
  if (isLocked) {
    return (
      <div className="bg-rose-600 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock size={16} className="shrink-0" />
          {isOwner
            ? "Your trial/subscription has ended. Actions are paused until you upgrade."
            : "This store's subscription has ended. Ask your owner to renew — actions are paused until then."}
        </div>
        {isOwner && (
          <Link
            href="/owner/billing"
            className="bg-white text-rose-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 text-center"
          >
            Upgrade Now
          </Link>
        )}
      </div>
    );
  }

  if (subscriptionStatus === "trialing" && trialDaysLeft !== null && trialDaysLeft <= 5) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Clock size={14} className="shrink-0" />
          {trialDaysLeft <= 0
            ? "Your free trial ends today."
            : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}
        </div>
        {isOwner && (
          <Link href="/owner/billing" className="text-xs font-bold underline underline-offset-2 shrink-0">
            View plans
          </Link>
        )}
      </div>
    );
  }

  return null;
}

/**
 * Wraps a premium-only feature (business summary chart, consignment).
 * Shows a blurred/locked preview with an upgrade prompt for Basic-plan
 * owners instead of hiding the feature entirely — this is what makes the
 * upgrade path visible and enticing rather than invisible.
 */
export function PremiumFeatureLock({
  featureName,
  isOwner,
  children,
}: {
  featureName: string;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="pointer-events-none select-none blur-sm opacity-50">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg-app)]/60 px-4 text-center">
        <Lock size={22} className="text-slate-500" />
        <p className="text-sm font-bold text-[var(--text-primary)]">{featureName} is a Premium feature</p>
        {isOwner ? (
          <Link
            href="/owner/billing"
            className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Upgrade to Premium
          </Link>
        ) : (
          <p className="text-xs text-slate-500">Ask your owner to upgrade to Premium.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Small inline banner for "you've hit your plan limit" moments — shown
 * instead of the create form when an owner is at their store/staff/product
 * cap on Basic.
 */
export function LimitReachedNotice({ reason, isOwner }: { reason: string; isOwner: boolean }) {
  return (
    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex flex-col items-center text-center gap-3">
      <AlertTriangle className="text-amber-500" size={24} />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{reason}</p>
      {isOwner ? (
        <Link
          href="/owner/billing"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
        >
          Upgrade to Premium
        </Link>
      ) : (
        <p className="text-xs text-slate-500">Ask your owner to upgrade the plan.</p>
      )}
    </div>
  );
}
