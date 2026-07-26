// FILE: apps/frontend/app/admin/users/[id]/page.tsx

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Store, Phone, Mail, Calendar, Package, Users, Gift, Crown, History, Shield } from "lucide-react";
import { OwnerActions } from "./OwnerActions";
import { OwnerTabs } from "./OwnerTabs";
import Image from "next/image";

export default async function OwnerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const owner = await prisma.user.findUnique({
    where: { id: parseInt(id) },
    include: {
      referredBy: {
        select: { id: true, fullName: true, email: true },
      },
      referrals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          subscriptionStatus: true,
          hasTriggeredReferralReward: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          reference: true,
        },
      },
    },
  });

  if (!owner) notFound();

  const subscribedCount = owner.referrals.filter((r) => r.hasTriggeredReferralReward).length;

  const statusStyles: Record<string, string> = {
    approved: "bg-emerald-900/30 text-emerald-400 border-emerald-500/20",
    declined: "bg-red-900/30 text-red-400 border-red-500/20",
    suspended: "bg-rose-900/30 text-rose-400 border-rose-500/20",
    pending: "bg-amber-900/30 text-amber-400 border-amber-500/20",
  };

  // maxPackageEnabled can be true even if `plan` itself hasn't caught up yet
  // (e.g. a manual admin grant before any payment), so it takes priority
  // for display purposes here — same precedence as resolveEffectivePlanId()
  // in lib/subscription-guard.ts.
  const currentPlan = owner.maxPackageEnabled ? "Max Package" : owner.plan || "Basic Plan";
  const planExpiryDate = owner.currentPeriodEnd 
    ? new Date(owner.currentPeriodEnd).toLocaleDateString() 
    : owner.trialEndsAt 
    ? new Date(owner.trialEndsAt).toLocaleDateString() 
    : "No active expiry date";
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:dark:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to owners
      </Link>

      {/* Header card with photo, status, and subscription crown badge */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-[var(--text-primary)] overflow-hidden border-2 border-slate-300 dark:border-slate-700 shrink-0 relative">
          {owner.image ? (
            <Image 
              src={owner.image} 
              alt={owner.fullName || "Owner"} 
              fill
              className="object-cover"
            />
          ) : (
            owner.fullName?.charAt(0).toUpperCase() || "?"
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{owner.fullName || "No Name Provided"}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusStyles[owner.status] || statusStyles.pending}`}>
              {owner.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm mb-2">{owner.email}</p>
          
          {/* Subscription Crown Badge below email */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold">
            <Crown size={14} className="text-amber-500" />
            <span>{currentPlan}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
              (Expires: {planExpiryDate})
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Contact */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Contact</h2>
          <div className="space-y-3">
            <InfoRow icon={Mail} label="Email" value={owner.email} />
            <InfoRow icon={Phone} label="Phone" value={owner.phoneNumber || "Not provided"} />
            <InfoRow icon={Calendar} label="Joined" value={owner.createdAt.toLocaleDateString()} />
          </div>
        </div>

        {/* Shop details */}
        <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Shop Details</h2>
          <div className="space-y-3">
            <InfoRow icon={Store} label="Shop name" value={owner.storeName || "Not provided"} />
            <InfoRow
              icon={MapPin}
              label="Location"
              value={
                [owner.shopAddress, owner.shopCity, owner.shopState].filter(Boolean).join(", ") || "Not provided"
              }
            />
            <InfoRow icon={Package} label="Sells" value={owner.productsSold || "Not provided"} />
          </div>
        </div>
      </div>

      {/* Tabbed Wrapper Section (Referrals, History, Actions) */}
      <OwnerTabs
        referralsTabContent={
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} /> Referrals & Rewards
              </h2>
              {owner.referrals.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">
                  {subscribedCount} of {owner.referrals.length} subscribed
                </span>
              )}
            </div>

            {owner.referredBy && (
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-wider mb-1">Referred by</p>
                <Link
                  href={`/admin/users/${owner.referredBy.id}`}
                  className="text-sm font-semibold text-[var(--text-primary)] hover:underline"
                >
                  {owner.referredBy.fullName || "No Name"}
                </Link>
                <span className="text-xs text-slate-500 ml-2">{owner.referredBy.email}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-wider mb-2">
              Referees ({owner.referrals.length})
            </p>

            {owner.referrals.length === 0 ? (
              <p className="text-sm text-slate-500">This owner hasn&apos;t referred anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {owner.referrals.map((referee) => (
                  <div
                    key={referee.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${referee.id}`}
                        className="text-sm font-semibold text-[var(--text-primary)] hover:underline truncate block"
                      >
                        {referee.fullName || "No Name"}
                      </Link>
                      <p className="text-[10px] text-slate-500 truncate">{referee.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                        referee.status.toLowerCase().trim() === "approved" ? "bg-emerald-900/30 text-emerald-400" :
                        referee.status.toLowerCase().trim() === "declined" ? "bg-red-900/30 text-red-400" :
                        referee.status.toLowerCase().trim() === "suspended" ? "bg-rose-900/30 text-rose-400" :
                        "bg-amber-900/30 text-amber-400"
                      }`}>
                        {referee.status}
                      </span>
                      {referee.hasTriggeredReferralReward ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-bold uppercase bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">
                          <Gift size={10} /> Reward: Earned
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-500">
                          No Reward Yet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
        historyTabContent={
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <History size={14} /> Subscription & Payment History
            </h2>

            {(!owner.payments || owner.payments.length === 0) ? (
              <p className="text-sm text-slate-500">No payment records found for this owner.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {owner.payments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{payment.reference || "N/A"}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {payment.amount ? `₦${payment.amount}` : "-"}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            payment.status === "success" || payment.status === "approved" ? "bg-emerald-900/30 text-emerald-400" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                          }`}>
                            {payment.status || "Completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        }
        actionsTabContent={
          <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={14} /> Owner Management Actions
            </h2>
            <OwnerActions
              email={owner.email}
              status={owner.status}
              productsSold={owner.productsSold}
              ownerId={owner.id}
              customPriceBasicNaira={owner.customPriceBasicNaira}
              customPriceBasicNote={owner.customPriceBasicNote}
              customPricePremiumNaira={owner.customPricePremiumNaira}
              customPricePremiumNote={owner.customPricePremiumNote}
              customPriceMaxNaira={owner.customPriceMaxNaira}
              customPriceMaxNote={owner.customPriceMaxNote}
              customPriceUpdatedAt={owner.customPriceUpdatedAt ? owner.customPriceUpdatedAt.toISOString() : null}
              scaleConsignmentEnabled={owner.scaleConsignmentEnabled}
              maxPackageEnabled={owner.maxPackageEnabled}
            />
          </div>
        }
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} className="text-slate-400 dark:text-slate-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}