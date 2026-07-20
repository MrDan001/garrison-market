import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

interface TrialTopBarProps {
  isLocked: boolean;
  subscriptionStatus: string; // "trialing" | "active" | "expired" | "cancelled"
  trialDaysLeft: number | null;
}

/**
 * Persistent red bar shown at the top of every /owner/* page (rendered by
 * app/owner/layout.tsx) so owners always know their free trial status
 * without it being added page-by-page.
 *
 * - Trial active: solid red bar with days remaining + "Upgrade" link.
 * - Trial/subscription ended (isLocked): darker red bar, stronger warning.
 * - Paid & active plan: renders nothing.
 */
export default function TrialTopBar({ isLocked, subscriptionStatus, trialDaysLeft }: TrialTopBarProps) {
  if (isLocked) {
    return (
      <div className="w-full bg-red-700 text-white text-center px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 flex-wrap">
        <AlertTriangle size={14} className="shrink-0" />
        <span>Your free trial has ended. Upgrade now to keep using Garrison Market.</span>
        <Link
          href="/owner/billing"
          className="underline underline-offset-2 font-extrabold hover:text-red-100 transition-colors"
        >
          Upgrade Now
        </Link>
      </div>
    );
  }

  if (subscriptionStatus === "trialing" && trialDaysLeft !== null) {
    const daysText =
      trialDaysLeft <= 0
        ? "ends today"
        : trialDaysLeft === 1
        ? "1 day left"
        : `${trialDaysLeft} days left`;

    return (
      <div className="w-full bg-red-600 text-white text-center px-4 py-1.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 flex-wrap">
        <Clock size={13} className="shrink-0" />
        <span>Free trial: {daysText}</span>
        <Link
          href="/owner/billing"
          className="underline underline-offset-2 font-bold hover:text-red-100 transition-colors"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return null;
}
