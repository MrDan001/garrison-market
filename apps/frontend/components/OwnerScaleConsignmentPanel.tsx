// FILE: apps/frontend/components/OwnerScaleConsignmentPanel.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Users, User, Zap } from "lucide-react";
import { ownerSignOutScaleToStaffAction } from "@/lib/consignment.actions";

interface ScaleItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface StaffOption {
  id: number;
  fullName: string | null;
  email: string;
}

interface StaffStockLine {
  staffId: number | null; // null = the store-wide shared consignment
  staffName: string;
  items: { name: string; unit: string; quantityOut: number; quantitySold: number; remaining: number }[];
}

// Stage 2: the daily sign-out-to-staff workflow, split out of
// OwnerScaleOverridePanel into its own Consignment tab. The owner can only
// pick from scale items that already exist (managed on the Scale tab via
// OwnerScaleInventoryGrid) — no "add new item" here. Same server action as
// before (ownerSignOutScaleToStaffAction) — only the layout changed.
//
// Stage 3: added a "Specific staff" vs "All Staff" toggle. All Staff signs
// out a single SHARED consignment (staffId: null) that every staff member
// at this store can sell against — one staff's sale instantly reduces what
// everyone else sees, since it's the same underlying row.
export default function OwnerScaleConsignmentPanel({
  items,
  staff,
  staffStock,
}: {
  items: ScaleItem[];
  staff: StaffOption[];
  staffStock: StaffStockLine[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [target, setTarget] = useState<"specific" | "all">("specific");
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0] ? String(staff[0].id) : "");
  const [signOutQty, setSignOutQty] = useState<Record<number, string>>({});
  const [signOutMsg, setSignOutMsg] = useState<string | null>(null);

  const handleSendEverything = () => {
    const next: Record<number, string> = {};
    for (const item of items) {
      if (item.quantity > 0) next[item.id] = String(item.quantity);
    }
    setSignOutQty(next);
  };

  const handleSignOut = () => {
    if (target === "specific" && !selectedStaffId) {
      setSignOutMsg("Choose a staff member first.");
      return;
    }
    const lines = Object.entries(signOutQty)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([id, v]) => ({
        scaleInventoryId: Number(id),
        enteredQty: parseFloat(v),
        enteredUnit: items.find((i) => i.id === Number(id))!.unit,
      }));

    if (lines.length === 0) {
      setSignOutMsg("Enter a quantity for at least one item.");
      return;
    }

    startTransition(async () => {
      try {
        await ownerSignOutScaleToStaffAction({
          staffId: target === "all" ? "all" : Number(selectedStaffId),
          items: lines,
        });
        setSignOutMsg(
          target === "all"
            ? "Signed out to all staff — it'll appear in everyone's scale inventory now."
            : "Signed out to staff — it'll appear in their scale inventory now."
        );
        setSignOutQty({});
        router.refresh();
      } catch (err: any) {
        setSignOutMsg(err?.message || "Failed to sign out.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] p-5 space-y-5">
      <div>
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Daily Consignment</h2>
        <p className="text-[11px] text-slate-500 mt-1">
          Sign out today's scale stock to staff. It resets automatically at midnight — unsold stock returns to
          Scale Inventory for you to sign out fresh the next day. Add new products from the Scale tab first;
          this page only signs out stock that already exists there.
        </p>
      </div>

      {/* Staff stock levels — so it's obvious who's low/out and needs a top-up */}
      {staffStock.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">Staff stock levels (today)</p>
          {staffStock.map((s) => {
            const totalRemaining = s.items.reduce((sum, i) => sum + i.remaining, 0);
            const isOut = totalRemaining <= 0;
            const isLow = !isOut && s.items.some((i) => i.quantityOut > 0 && i.remaining / i.quantityOut <= 0.2);
            const isShared = s.staffId === null;
            return (
              <div key={s.staffId ?? "shared"} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    {isShared && <Users size={12} className="text-blue-400" />}
                    {s.staffName}
                  </span>
                  {isOut && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Out
                    </span>
                  )}
                  {isLow && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Low
                    </span>
                  )}
                </div>
                {s.items.map((i) => (
                  <p key={i.name} className="text-[11px] text-slate-500">
                    {i.name}: {i.remaining}
                    {i.unit} left of {i.quantityOut}
                    {i.unit}
                  </p>
                ))}
                {(isOut || isLow) && (
                  <button
                    onClick={() => {
                      if (isShared) {
                        setTarget("all");
                      } else {
                        setTarget("specific");
                        setSelectedStaffId(String(s.staffId));
                      }
                    }}
                    className="text-[11px] font-semibold text-blue-500 hover:text-blue-400"
                  >
                    Top up {isShared ? "the shared pool" : "this staff member"} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sign out to staff */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <p className="text-xs font-semibold text-slate-400">Sign out today's stock to staff</p>
        {staff.length === 0 ? (
          <p className="text-xs text-slate-500">No staff assigned to this store yet.</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500">No scale products yet — add one from the Scale tab first.</p>
        ) : (
          <>
            {/* Specific staff vs All Staff toggle */}
            <div className="flex rounded-lg border border-slate-800 overflow-hidden">
              <button
                onClick={() => setTarget("specific")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                  target === "specific" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <User size={13} /> Specific staff
              </button>
              <button
                onClick={() => setTarget("all")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                  target === "all" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users size={13} /> All Staff
              </button>
            </div>

            {target === "specific" && (
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.email}
                  </option>
                ))}
              </select>
            )}
            {target === "all" && (
              <p className="text-[11px] text-slate-500 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                Creates one shared consignment every staff member at this store can sell against — a sale by any of
                them reduces the same shared balance for everyone else.
              </p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500">Enter quantities, or auto-fill everything below.</p>
              <button
                onClick={handleSendEverything}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <Zap size={11} /> Send Everything
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-400 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-600">
                      {item.quantity}
                      {item.unit} in stock
                    </span>
                  </div>
                  <input
                    type="number"
                    placeholder={`Qty (${item.unit})`}
                    value={signOutQty[item.id] || ""}
                    onChange={(e) => setSignOutQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              ))}
            </div>
            <button
              disabled={isPending}
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white"
            >
              <Send size={13} /> {target === "all" ? "Sign Out to All Staff" : "Sign Out to Staff"}
            </button>
            {signOutMsg && <p className="text-[11px] text-slate-400">{signOutMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}