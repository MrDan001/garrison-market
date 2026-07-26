// FILE: apps/frontend/app/admin/users/[id]/OwnerActions.tsx

"use client";

import { useState, useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerStatus, deleteUser, extendSubscriptionAction, setCustomPriceAction, setScaleConsignmentOverrideAction, setMaxPackageOverrideAction } from "@/lib/auth.actions";
import { CalendarPlus, Tag, Scale, Crown } from "lucide-react";

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

// Added productsSold to the TypeScript interface
interface OwnerActionsProps {
  email: string;
  status: string;
  productsSold?: string | null;
  ownerId?: number;
  customPriceBasicNaira?: number | null;
  customPriceBasicNote?: string | null;
  customPricePremiumNaira?: number | null;
  customPricePremiumNote?: string | null;
  customPriceMaxNaira?: number | null;
  customPriceMaxNote?: string | null;
  customPriceUpdatedAt?: string | null;
  scaleConsignmentEnabled?: boolean;
  maxPackageEnabled?: boolean;
}

export function OwnerActions({
  email,
  status,
  productsSold,
  ownerId,
  customPriceBasicNaira,
  customPriceBasicNote,
  customPricePremiumNaira,
  customPricePremiumNote,
  customPriceMaxNaira,
  customPriceMaxNote,
  customPriceUpdatedAt,
  scaleConsignmentEnabled,
  maxPackageEnabled,
}: OwnerActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState("7");
  const [extendMsg, setExtendMsg] = useState<string | null>(null);
  const [scaleMsg, setScaleMsg] = useState<string | null>(null);
  const [maxMsg, setMaxMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = (action: () => Promise<any>, navigateAfter?: string) => {
    startTransition(async () => {
      await action();
      if (navigateAfter) router.push(navigateAfter);
      else router.refresh();
    });
  };

  const handleExtend = () => {
    if (!ownerId) return;
    const n = parseInt(days, 10);
    if (!n || n <= 0) {
      setExtendMsg("Enter a valid number of days.");
      return;
    }
    startTransition(async () => {
      const result = await extendSubscriptionAction(ownerId, n);
      setExtendMsg(result.success ? `Added ${n} day(s).` : result.error || "Failed to extend.");
      router.refresh();
    });
  };

  const handleScaleToggle = () => {
    if (!ownerId) return;
    const next = !scaleConsignmentEnabled;
    startTransition(async () => {
      const result = await setScaleConsignmentOverrideAction(ownerId, next);
      setScaleMsg(
        result.success
          ? next
            ? "Scale Consignment turned ON for this owner."
            : "Scale Consignment turned OFF for this owner."
          : result.error || "Failed to update."
      );
      router.refresh();
    });
  };

  const handleMaxToggle = () => {
    if (!ownerId) return;
    const next = !maxPackageEnabled;
    startTransition(async () => {
      const result = await setMaxPackageOverrideAction(ownerId, next);
      setMaxMsg(
        result.success
          ? next
            ? "Max Package turned ON for this owner — unlimited stores/staff/products, all features unlocked."
            : "Max Package turned OFF for this owner."
          : result.error || "Failed to update."
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <button
            disabled={isPending}
            onClick={() => handleAction(() => updateOwnerStatus(email, "approved"))}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => handleAction(() => updateOwnerStatus(email, "declined"))}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Decline
          </button>
        </>
      )}
      {status === "approved" && (
        <button
          disabled={isPending}
          onClick={() => handleAction(() => updateOwnerStatus(email, "suspended"))}
          className="px-4 py-2 bg-rose-900/50 hover:bg-rose-900/70 disabled:opacity-50 rounded-lg text-xs font-bold text-rose-200 transition-colors"
        >
          Suspend
        </button>
      )}
      {status === "suspended" && (
        <button
          disabled={isPending}
          onClick={() => handleAction(() => updateOwnerStatus(email, "approved"))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
        >
          Reinstate
        </button>
      )}
      {ownerId && (
        <div className="flex items-center gap-2 w-full mt-1 pt-3 border-t border-slate-800">
          <CalendarPlus size={14} className="text-slate-500 shrink-0" />
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
          <button
            disabled={isPending}
            onClick={handleExtend}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Add Days (Manual)
          </button>
          {extendMsg && <span className="text-[11px] text-slate-400">{extendMsg}</span>}
        </div>
      )}
      {ownerId && (
        <div className="w-full mt-1 pt-3 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-400">Negotiated monthly pricing</span>
            {customPriceUpdatedAt && (
              <span className="text-[11px] text-slate-500">
                · last updated {new Date(customPriceUpdatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <RateRow
            ownerId={ownerId}
            plan="basic"
            label="Basic"
            currentPrice={customPriceBasicNaira ?? null}
            currentNote={customPriceBasicNote ?? null}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />

          <RateRow
            ownerId={ownerId}
            plan="premium"
            label="Premium"
            currentPrice={customPricePremiumNaira ?? null}
            currentNote={customPricePremiumNote ?? null}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />

          <RateRow
            ownerId={ownerId}
            plan="max"
            label="Max Package"
            currentPrice={customPriceMaxNaira ?? null}
            currentNote={customPriceMaxNote ?? null}
            isPending={isPending}
            startTransition={startTransition}
            router={router}
          />

          <p className="text-[10px] text-slate-500">
            There is no standard/default price — each plan is priced only once you set a rate here for this owner.
            Quarterly/bi-annual/annual discounts still apply on top of it. Until a rate is set, the plan shows as
            unpriced on the owner's billing page and they cannot check out for it. For Max Package specifically,
            set this only after negotiating a rate with the owner directly (they reach you via Support or email) —
            once they pay at that rate, the Max Package unlock below turns on automatically.
          </p>
        </div>
      )}
      {ownerId && (
        <div className="w-full mt-1 pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <Scale size={14} className="text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-400">Scale Consignment override</span>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                scaleConsignmentEnabled
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {scaleConsignmentEnabled ? "On" : "Off"}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            When ON, this owner can stock Scale (weight/volume) inventory and sign it out to staff via daily
            consignment — even though their store is a standard store. Standard inventory is unaffected. Any stock
            not sold gets returned to the owner and the staff view resets automatically at midnight.
          </p>
          <button
            disabled={isPending}
            onClick={handleScaleToggle}
            className={`px-3 py-1.5 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors ${
              scaleConsignmentEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                : "bg-teal-600 hover:bg-teal-500 text-white"
            }`}
          >
            {scaleConsignmentEnabled ? "Turn Off" : "Turn On"}
          </button>
          {scaleMsg && <span className="ml-2 text-[11px] text-slate-400">{scaleMsg}</span>}
        </div>
      )}
      {ownerId && (
        <div className="w-full mt-1 pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-400">Max Package unlock</span>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                maxPackageEnabled
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {maxPackageEnabled ? "On" : "Off"}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            This turns ON AUTOMATICALLY the moment this owner pays for Max Package at the negotiated rate above —
            you don't need to touch it for a normal purchase. Use this switch only to grant it manually as a
            courtesy (without a payment), or to revoke it. While ON, this owner gets unlimited stores, staff, and
            products, plus every gated feature, regardless of trial or subscription period status.
          </p>
          <button
            disabled={isPending}
            onClick={handleMaxToggle}
            className={`px-3 py-1.5 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors ${
              maxPackageEnabled
                ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                : "bg-amber-600 hover:bg-amber-500 text-white"
            }`}
          >
            {maxPackageEnabled ? "Turn Off" : "Turn On"}
          </button>
          {maxMsg && <span className="ml-2 text-[11px] text-slate-400">{maxMsg}</span>}
        </div>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (window.confirm("Permanently delete this owner account? This can't be undone.")) {
            handleAction(() => deleteUser(email), "/admin/users");
          }
        }}
        className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 disabled:opacity-50 rounded-lg text-xs font-bold text-red-200 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}

function RateRow({
  ownerId,
  plan,
  label,
  currentPrice,
  currentNote,
  isPending,
  startTransition,
  router,
}: {
  ownerId: number;
  plan: "basic" | "premium" | "max";
  label: string;
  currentPrice: number | null;
  currentNote: string | null;
  isPending: boolean;
  startTransition: TransitionStartFunction;
  router: ReturnType<typeof useRouter>;
}) {
  const [priceInput, setPriceInput] = useState(currentPrice ? String(currentPrice) : "");
  const [noteInput, setNoteInput] = useState(currentNote || "");
  const [msg, setMsg] = useState<string | null>(null);

  const handleSet = () => {
    const n = parseInt(priceInput, 10);
    if (!n || n <= 0) {
      setMsg("Enter a valid monthly price in Naira.");
      return;
    }
    startTransition(async () => {
      const result = await setCustomPriceAction(ownerId, plan, n, noteInput.trim() || undefined);
      setMsg(result.success ? `${label} rate set to ${naira(n)}/mo.` : result.error || "Failed to set price.");
      router.refresh();
    });
  };

  const handleClear = () => {
    startTransition(async () => {
      const result = await setCustomPriceAction(ownerId, plan, null);
      setMsg(result.success ? `${label} rate cleared — back to standard pricing.` : result.error || "Failed to clear price.");
      setPriceInput("");
      setNoteInput("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-300">{label} plan</span>
        {currentPrice ? (
          <span className="text-[11px] text-emerald-400 font-medium">Currently {naira(currentPrice)}/mo</span>
        ) : (
          <span className="text-[11px] text-amber-500 font-medium">No rate set — owner can't pay for this plan yet</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          placeholder="e.g. 4500"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
        />
        <input
          type="text"
          placeholder="Reason (optional, e.g. smaller store capacity)"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          className="flex-1 min-w-[180px] bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
        />
        <button
          disabled={isPending}
          onClick={handleSet}
          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
        >
          Save Rate
        </button>
        {currentPrice ? (
          <button
            disabled={isPending}
            onClick={handleClear}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-xs font-bold text-slate-300 transition-colors"
          >
            Clear
          </button>
        ) : null}
      </div>
      {msg && <span className="text-[11px] text-slate-400">{msg}</span>}
    </div>
  );
}