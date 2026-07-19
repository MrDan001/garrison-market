"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, Loader2 } from "lucide-react";
import { getOwnerBillingInfo, startCheckoutAction } from "@/lib/billing.actions";
import { PLANS, BILLING_CYCLES, getCyclePrice, type PlanId, type BillingCycleId } from "@/lib/plans";

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("basic");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleId>("quarterly");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOwnerBillingInfo()
      .then((data) => {
        setInfo(data);
        setSelectedPlan((data.status.plan as PlanId) || "basic");
        if (!data.isOwner) router.push("/staff/dashboard");
      })
      .catch(() => setError("Could not load billing information."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCheckout() {
    setCheckingOut(true);
    setError(null);
    try {
      const result = await startCheckoutAction(selectedPlan, selectedCycle);
      if ("error" in result) {
        // FIXED: Added fallback string to avoid passing undefined into string | null state
        setError(result.error || "An error occurred during checkout setup.");
        setCheckingOut(false);
        return;
      }
      window.location.href = result.authorizationUrl;
    } catch {
      setError("Something went wrong starting checkout. Please try again.");
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  const status = info?.status;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-16">
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Billing & Subscription</h1>
      </div>

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        {/* Current status card */}
        <div className={`rounded-2xl border p-5 ${status?.isLocked ? "bg-rose-500/5 border-rose-500/30" : "bg-emerald-500/5 border-emerald-500/30"}`}>
          <div className="flex items-center gap-2 mb-2">
            {status?.isLocked ? (
              <XCircle className="text-rose-500" size={20} />
            ) : (
              <CheckCircle2 className="text-emerald-500" size={20} />
            )}
            <h2 className="font-bold text-[var(--text-primary)]">
              {status?.isLocked
                ? "Subscription inactive"
                : status?.subscriptionStatus === "trialing"
                ? "Free trial active"
                : "Subscription active"}
            </h2>
          </div>

          {status?.subscriptionStatus === "trialing" && !status?.isLocked && (
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Clock size={14} /> {status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} left in your free trial
            </p>
          )}
          {status?.subscriptionStatus === "active" && !status?.isLocked && status?.currentPeriodEnd && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Current plan: <span className="font-semibold text-[var(--text-primary)]">{PLANS[status.plan as PlanId]?.name}</span> — renews{" "}
              {new Date(status.currentPeriodEnd).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
          {status?.isLocked && (
            <p className="text-sm text-rose-500/90">
              Your trial or subscription has ended. Choose a plan below to unlock your account again — all your data is safe and untouched.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm font-semibold text-rose-500">
            {error}
          </div>
        )}

        {/* Plan picker */}
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PLANS) as PlanId[]).map((planId) => {
            const plan = PLANS[planId];
            const isSelected = selectedPlan === planId;
            return (
              <button
                key={planId}
                onClick={() => setSelectedPlan(planId)}
                className={`text-left rounded-2xl border-2 p-4 transition-all ${
                  isSelected
                    ? "border-blue-600 bg-blue-500/5"
                    : "border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <p className="font-bold text-[var(--text-primary)] mb-1">{plan.name}</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mb-3">
                  {naira(plan.priceNaira)}
                  <span className="text-xs font-medium text-slate-500">/mo</span>
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <li>{plan.maxStores} store{plan.maxStores > 1 ? "s" : ""}</li>
                  <li>{plan.maxStaff} staff accounts</li>
                  <li>{plan.maxProducts} products</li>
                  <li className={plan.businessSummaryChart ? "text-emerald-500" : "text-slate-400 dark:text-slate-600"}>
                    {plan.businessSummaryChart ? "✓" : "✕"} Business summary chart
                  </li>
                  <li className={plan.consignment ? "text-emerald-500" : "text-slate-400 dark:text-slate-600"}>
                    {plan.consignment ? "✓" : "✕"} Consignment
                  </li>
                </ul>
              </button>
            );
          })}
        </div>

        {/* Cycle picker */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Billing cycle</p>
          <div className="space-y-2">
            {(Object.keys(BILLING_CYCLES) as BillingCycleId[]).map((cycleId) => {
              const cycle = BILLING_CYCLES[cycleId];
              const price = getCyclePrice(selectedPlan, cycleId);
              const isSelected = selectedCycle === cycleId;
              return (
                <button
                  key={cycleId}
                  onClick={() => setSelectedCycle(cycleId)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all ${
                    isSelected
                      ? "border-blue-600 bg-blue-500/5"
                      : "border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)]"
                  }`}
                >
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {cycle.label}
                    {cycle.discountPct > 0 && (
                      <span className="ml-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        SAVE {cycle.discountPct}%
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{naira(price)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-colors"
        >
          {checkingOut ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Redirecting to Paystack...
            </>
          ) : (
            <>
              <CreditCard size={18} /> Pay {naira(getCyclePrice(selectedPlan, selectedCycle))} with Paystack
            </>
          )}
        </button>

        {/* Payment history */}
        {info?.payments?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment history</p>
            <div className="space-y-2">
              {info.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[var(--text-primary)] capitalize">{p.plan} plan</p>
                    <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--text-primary)]">{naira(Number(p.amount))}</p>
                    <p className={`text-xs font-medium ${p.status === "success" ? "text-emerald-500" : p.status === "pending" ? "text-amber-500" : "text-rose-500"}`}>
                      {p.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}