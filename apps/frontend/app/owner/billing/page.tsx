// FILE: apps/frontend/app/owner/billing/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Clock, CreditCard, Loader2, Crown, MessageCircle, AlertCircle, ChevronDown } from "lucide-react";
import { getOwnerBillingInfo, startCheckoutAction } from "@/lib/billing.actions";
import { PLANS, BILLING_CYCLES, getCyclePrice, getCycleDiscountPct, type PlanId, type BillingCycleId } from "@/lib/plans";

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

// Pricing is fully negotiated — there's no standard price to fall back to.
// Render a dash until an admin sets a rate for this owner+plan.
const nairaOrDash = (n: number | null) => (n === null ? "—" : naira(n));

// Max Package's limits are Infinity (see PLANS.max in lib/plans.ts) — show
// that as "Unlimited" instead of the literal word "Infinity".
const displayLimit = (n: number) => (n === Infinity ? "Unlimited" : n);

// Fixed dark theme, deliberately not wired to the app's --bg-app/--text-primary
// light/dark tokens — this screen is meant to read like a paywall (App
// Store, Duolingo, etc. all do the same thing), not blend into whichever
// mode the rest of the app happens to be in.
const CYCLE_ORDER: BillingCycleId[] = ["quarterly", "biannual", "annual"];
const CYCLE_SHORT_LABEL: Record<BillingCycleId, string> = {
  quarterly: "Quarterly",
  biannual: "Bi-Annual",
  annual: "Annual",
};

// Each plan's accent — the one bold, spend-it-in-one-place move on this
// page. Basic stays quiet on purpose (it's not the plan we're trying to
// sell), Premium and Max each carry a distinct gradient identity so
// they're recognizable even before you read the price.
const PLAN_ACCENT: Record<PlanId, { ring: string; glow: string; grad: string; text: string; badge: string; badgeLabel: string | null }> = {
  basic: {
    ring: "border-white/10",
    glow: "",
    grad: "from-white/10 to-white/5",
    text: "text-white/70",
    badge: "",
    badgeLabel: null,
  },
  premium: {
    ring: "border-fuchsia-400/60",
    glow: "shadow-[0_0_40px_-8px_rgba(217,70,239,0.55)]",
    grad: "from-fuchsia-500 to-pink-500",
    text: "text-fuchsia-300",
    badge: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-400/30",
    badgeLabel: "Most Popular",
  },
  max: {
    ring: "border-amber-300/60",
    glow: "shadow-[0_0_40px_-8px_rgba(251,191,36,0.5)]",
    grad: "from-amber-400 to-orange-500",
    text: "text-amber-300",
    badge: "bg-amber-400/15 text-amber-300 border border-amber-300/30",
    badgeLabel: "Best Value",
  },
};

// Full "what you get" copy per plan, generated from the same PLANS data
// the rest of the page reads — so this can never drift out of sync with
// what's actually gated. Basic gets a flat list; Pro and Max lead with a
// "Everything in X, plus" line to reinforce that each tier is a strict
// superset of the one below it (Basic ⊂ Pro ⊂ Max), not a separate bundle.
function getGoodies(planId: PlanId): { supersetOf: string | null; items: string[] } {
  const plan = PLANS[planId];
  const items: string[] = [];

  items.push(
    `${displayLimit(plan.maxStores)} store${plan.maxStores !== 1 ? "s" : ""}, ${displayLimit(plan.maxStaff)} staff logins, ${displayLimit(plan.maxProducts)} products`
  );

  if (planId === "basic") {
    items.push("Full inventory, checkout, expenses & invoices");
    items.push("Daily reports, staff management & announcements");
    items.push("Push notifications, admin chat & screenshot lock");
  }
  if (plan.businessSummaryChart) items.push("Sales & business summary chart");
  if (plan.debtors) items.push("Debtors — part-payments with full history");
  if (plan.customerProfiles) items.push("Customer profiles ranked by spend");
  if (plan.staffConsignment) items.push("Staff consignment — sign stock out to customers");
  if (plan.ownerConsignment) items.push("Owner consignment — sign stock out yourself too");

  return {
    supersetOf: planId === "premium" ? "Basic" : planId === "max" ? "Pro" : null,
    items,
  };
}

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

  const customPriceBasicNaira: number | null = info?.customPriceBasicNaira ?? null;
  const customPricePremiumNaira: number | null = info?.customPricePremiumNaira ?? null;
  const customPriceMaxNaira: number | null = info?.customPriceMaxNaira ?? null;
  const maxPackageEnabled: boolean = info?.maxPackageEnabled ?? false;

  const customPriceForPlan = (planId: PlanId) =>
    planId === "premium" ? customPricePremiumNaira : planId === "max" ? customPriceMaxNaira : customPriceBasicNaira;

  const selectedCustomPrice = customPriceForPlan(selectedPlan);
  const accent = PLAN_ACCENT[selectedPlan];

  async function handleCheckout() {
    setCheckingOut(true);
    setError(null);
    try {
      const result = await startCheckoutAction(selectedPlan, selectedCycle);
      if ("error" in result) {
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
      <div className="min-h-screen flex items-center justify-center bg-[#0B0A17]">
        <Loader2 className="animate-spin text-white/40" size={26} />
      </div>
    );
  }

  const status = info?.status;
  const cycleIndex = CYCLE_ORDER.indexOf(selectedCycle);

  return (
    <div className="relative min-h-screen bg-[#0B0A17] text-white overflow-x-hidden">
      {/* Reduced-motion escape hatch for every transition/animation on this page */}
      <style>{`
        @keyframes billingFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .billing-fade-up { animation: billingFadeUp 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .billing-fade-up { animation: none; }
          * { transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Ambient glow field — the ONE atmospheric flourish, fixed so it doesn't repaint on scroll */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-cyan-500/20 blur-[110px]" />
        <div className="absolute top-1/3 -right-32 w-[460px] h-[460px] rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[380px] h-[380px] rounded-full bg-amber-500/10 blur-[110px]" />
      </div>

      <div className="relative z-10 pb-40">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#0B0A17]/70 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-4">
            <Link href="/owner/dashboard" className="text-white/50 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-semibold">Billing &amp; Subscription</h1>
          </div>
        </div>

        <div className="max-w-md mx-auto px-5 pt-6 space-y-6">
          {/* Hero */}
          <div className="text-center pt-2 pb-1 billing-fade-up">
            <h2 className="text-[26px] font-extrabold tracking-tight">Unlock your plan</h2>
            <p className="text-sm text-white/50 mt-1">Pick what fits how your shop runs</p>
          </div>

          {/* Status pill */}
          {status && (
            <div
              className={`billing-fade-up flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                status.isLocked
                  ? "border-rose-400/30 bg-rose-500/10"
                  : status.subscriptionStatus === "trialing"
                  ? "border-cyan-400/30 bg-cyan-500/10"
                  : "border-emerald-400/30 bg-emerald-500/10"
              }`}
            >
              {status.isLocked ? (
                <AlertCircle size={18} className="text-rose-300 shrink-0" />
              ) : status.subscriptionStatus === "trialing" ? (
                <Clock size={18} className="text-cyan-300 shrink-0" />
              ) : (
                <Check size={18} className="text-emerald-300 shrink-0" />
              )}
              <p className="text-[13px] text-white/80 leading-snug">
                {status.isLocked && "Your access is paused — pick a plan below to restore it."}
                {status.subscriptionStatus === "trialing" && !status.isLocked && (
                  <>{status.trialDaysLeft} day{status.trialDaysLeft === 1 ? "" : "s"} left on your free trial</>
                )}
                {status.subscriptionStatus === "active" && !status.isLocked && status.currentPeriodEnd && (
                  <>
                    {PLANS[status.plan as PlanId]?.name} · renews{" "}
                    {new Date(status.currentPeriodEnd).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </>
                )}
              </p>
              {maxPackageEnabled && <Crown size={16} className="text-amber-300 ml-auto shrink-0" />}
            </div>
          )}

          {error && (
            <div className="billing-fade-up rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {/* Billing cycle — sliding 3-segment pill */}
          <div className="billing-fade-up">
            <div className="relative grid grid-cols-3 rounded-full border border-white/10 bg-white/5 p-1">
              <div
                className="absolute inset-y-1 left-1 w-[calc(33.333%-4px)] rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${cycleIndex * 100}%)` }}
              />
              {CYCLE_ORDER.map((cycleId) => {
                const discountPct = getCycleDiscountPct(selectedPlan, cycleId);
                const isActive = selectedCycle === cycleId;
                return (
                  <button
                    key={cycleId}
                    onClick={() => setSelectedCycle(cycleId)}
                    className="relative z-10 flex flex-col items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-colors"
                  >
                    <span className={isActive ? "text-[#0B0A17]" : "text-white/70"}>{CYCLE_SHORT_LABEL[cycleId]}</span>
                    {discountPct > 0 && (
                      <span className={`text-[10px] font-bold ${isActive ? "text-[#0B0A17]/70" : "text-emerald-300/80"}`}>
                        Save {discountPct}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan cards */}
          <div className="space-y-3">
            {(Object.keys(PLANS) as PlanId[]).map((planId, i) => {
              const plan = PLANS[planId];
              const isSelected = selectedPlan === planId;
              const planAccent = PLAN_ACCENT[planId];
              const displayMonthly = customPriceForPlan(planId);
              const cyclePrice = getCyclePrice(planId, selectedCycle, displayMonthly);
              const goodies = getGoodies(planId);

              return (
                <div
                  key={planId}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`billing-fade-up rounded-3xl border-[1.5px] transition-all duration-300 overflow-hidden ${
                    isSelected
                      ? `${planAccent.ring} bg-white/[0.06] ${planAccent.glow}`
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <button onClick={() => setSelectedPlan(planId)} className="w-full text-left p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {planId === "max" && <Crown size={15} className="text-amber-300" />}
                        <span className="font-semibold text-[15px]">{plan.name}</span>
                        {planAccent.badgeLabel && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planAccent.badge}`}>
                            {planAccent.badgeLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-extrabold tabular-nums">
                          {nairaOrDash(cyclePrice)}
                          {cyclePrice !== null && (
                            <span className="text-[10px] font-medium text-white/40"> /{BILLING_CYCLES[selectedCycle].months}mo</span>
                          )}
                        </p>
                        <ChevronDown
                          size={16}
                          className={`text-white/40 transition-transform duration-300 ${isSelected ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Goodies — grid-rows 0fr→1fr is what makes this animate
                      smoothly to an unknown content height, which a plain
                      max-height transition can't do without guessing a
                      number that's either too small or janky. */}
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isSelected ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 pt-1">
                        {goodies.supersetOf && (
                          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2">
                            <span className={planAccent.text}>Everything in {goodies.supersetOf}, plus:</span>
                          </p>
                        )}
                        <ul className="space-y-2">
                          {goodies.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[13px] text-white/75">
                              <Check size={14} className={`mt-[1px] shrink-0 ${planAccent.text || "text-white/40"}`} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment history */}
          {info?.payments?.length > 0 && (
            <div className="billing-fade-up pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mb-2">Payment history</p>
              <div className="space-y-2">
                {info.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium capitalize">{p.plan} plan</p>
                      <p className="text-xs text-white/40">{new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{naira(Number(p.amount))}</p>
                      <p className={`text-xs font-medium ${p.status === "success" ? "text-emerald-300" : p.status === "pending" ? "text-amber-300" : "text-rose-300"}`}>
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

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#0B0A17] via-[#0B0A17]/95 to-transparent pt-10 pb-6">
        <div className="max-w-md mx-auto px-5">
          {selectedCustomPrice === null ? (
            <div className="space-y-2">
              <Link
                href="/owner/support"
                className="w-full flex items-center justify-center gap-2 rounded-full py-4 font-bold text-[#0B0A17] bg-gradient-to-r from-white to-white/90 active:scale-[0.99] transition-transform"
              >
                <MessageCircle size={17} /> Contact admin about {PLANS[selectedPlan].name}
              </Link>
             {/* <p className="text-center text-[11px] text-white/40">
                Or email <a href="mailto:support@garrison.com" className="underline text-white/60">support@garrison.com</a>
              </p> */}
            </div>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className={`w-full flex items-center justify-center gap-2 rounded-full py-4 font-bold text-[#0B0A17] bg-gradient-to-r ${accent.grad || "from-white to-white/90"} disabled:opacity-60 active:scale-[0.99] transition-transform shadow-[0_10px_40px_-10px_rgba(217,70,239,0.5)]`}
            >
              {checkingOut ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Redirecting to Paystack...
                </>
              ) : (
                <>
                  <CreditCard size={18} /> Continue — {naira(getCyclePrice(selectedPlan, selectedCycle, selectedCustomPrice)!)}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}