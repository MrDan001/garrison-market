// FILE: apps/frontend/app/staff/consignment/scale-consignment-client.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Truck, X, User, Phone, FileText, CheckCircle2, Clock, Store, Scale as ScaleIcon,
} from "lucide-react";
import { signOutScaleConsignment, settleScaleConsignment } from "@/lib/consignment.actions";
import { unitsForBase, convertToBaseUnit } from "@/lib/scale-units";

interface ScaleItem {
  id: number;
  name: string;
  quantity: number; // in base unit
  unit: string; // "kg" | "L"
  price: number;
}

interface CartLine {
  scaleInventoryId: number;
  name: string;
  baseUnit: string;
  maxBaseQty: number;
  enteredQty: string; // kept as string while editing
  enteredUnit: string;
}

export default function StaffScaleConsignmentClient({
  enabled,
  inventory,
  openConsignments,
  history,
  hideSignOutTab = false,
}: {
  enabled: boolean;
  inventory: ScaleItem[];
  openConsignments: any[];
  history: any[];
  // True in the admin-override case (standard store + scaleConsignmentEnabled):
  // staff never sign stock out themselves there — only the owner signs out
  // to them — so the "Sign Out" tab is hidden and staff land on "Open".
  hideSignOutTab?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"new" | "open" | "history">(
    hideSignOutTab ? "open" : openConsignments.length > 0 ? "open" : "new"
  );

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientNote, setRecipientNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleValues, setSettleValues] = useState<Record<number, number>>({}); // itemId -> quantitySold (base unit)
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center px-6 text-center">
        <Truck size={40} className="text-slate-300 dark:text-slate-700 mb-4" />
        <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">Consignment isn't enabled</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          Ask your store owner to turn on consignment access in settings before you can sign out goods.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-6 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  const addItemToCart = () => {
    if (!selectedItemId) return;
    const inv = inventory.find((i) => i.id === Number(selectedItemId));
    if (!inv || inv.quantity <= 0) return;
    if (cart.find((c) => c.scaleInventoryId === inv.id)) return;

    setCart((prev) => [
      ...prev,
      { scaleInventoryId: inv.id, name: inv.name, baseUnit: inv.unit, maxBaseQty: inv.quantity, enteredQty: "", enteredUnit: inv.unit },
    ]);
    setSelectedItemId("");
  };

  const updateCartLine = (scaleInventoryId: number, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((c) => (c.scaleInventoryId === scaleInventoryId ? { ...c, ...patch } : c)));
  };

  const removeFromCart = (scaleInventoryId: number) => {
    setCart((prev) => prev.filter((c) => c.scaleInventoryId !== scaleInventoryId));
  };

  const handleSignOut = async () => {
    setFormError(null);
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setFormError("Recipient name and phone are required.");
      return;
    }
    if (cart.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    for (const line of cart) {
      const val = parseFloat(line.enteredQty);
      if (isNaN(val) || val <= 0) {
        setFormError(`Enter a valid amount for ${line.name}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await signOutScaleConsignment({
        recipientName,
        recipientPhone,
        recipientNote,
        items: cart.map((c) => ({
          scaleInventoryId: c.scaleInventoryId,
          enteredQty: parseFloat(c.enteredQty),
          enteredUnit: c.enteredUnit,
        })),
      });
      setRecipientName("");
      setRecipientPhone("");
      setRecipientNote("");
      setCart([]);
      window.location.reload();
    } catch (err: any) {
      setFormError(err.message || "Failed to sign out consignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openSettle = (consignment: any) => {
    setSettlingId(consignment.id);
    setSettleError(null);
    const initial: Record<number, number> = {};
    consignment.scaleItems.forEach((item: any) => {
      initial[item.id] = Number(item.quantityOut); // default: assume all sold, staff adjusts
    });
    setSettleValues(initial);
  };

  const handleSettle = async (consignment: any) => {
    setSettling(true);
    setSettleError(null);
    try {
      const settlements = consignment.scaleItems.map((item: any) => {
        const sold = settleValues[item.id] ?? 0;
        return {
          itemId: item.id,
          quantitySold: sold,
          quantityReturned: Number(item.quantityOut) - sold,
        };
      });
      await settleScaleConsignment(consignment.id, settlements);
      setSettlingId(null);
      window.location.reload();
    } catch (err: any) {
      setSettleError(err.message || "Failed to settle consignment.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-24">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Truck size={18} className="text-blue-400" /> Consignment
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
            <ScaleIcon size={10} /> Scale
          </span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4">
        {(["new", "open", "history"] as const)
          .filter((t) => !(hideSignOutTab && t === "new"))
          .map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
            }`}
          >
            {t === "new" ? "Sign Out" : t === "open" ? `Open (${openConsignments.length})` : "History"}
          </button>
        ))}
      </div>

      {/* NEW SIGN-OUT TAB */}
      {tab === "new" && (
        <div className="p-4 space-y-4">
          <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recipient</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-slate-500" />
              <textarea
                value={recipientNote}
                onChange={(e) => setRecipientNote(e.target.value)}
                placeholder="Note (optional) — address, agreement details, etc."
                className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items to Sign Out</label>
            <div className="flex gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600 transition-colors"
              >
                <option value="">Select an item...</option>
                {inventory
                  .filter((inv) => inv.quantity > 0 && !cart.find((c) => c.scaleInventoryId === inv.id))
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.quantity}{inv.unit} in stock)
                    </option>
                  ))}
              </select>
              <button
                onClick={addItemToCart}
                disabled={!selectedItemId}
                className="px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white text-sm font-semibold transition-colors"
              >
                Add
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-600 italic py-2">No items added yet.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => {
                  const pair = unitsForBase(line.baseUnit);
                  return (
                    <div key={line.scaleInventoryId} className="bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{line.name}</p>
                        <button onClick={() => removeFromCart(line.scaleInventoryId)} className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Amount"
                          value={line.enteredQty}
                          onChange={(e) => updateCartLine(line.scaleInventoryId, { enteredQty: e.target.value })}
                          className="flex-1 bg-[var(--bg-app)] border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-500"
                        />
                        {pair && (
                          <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden shrink-0">
                            {[pair.base, pair.sub].map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => updateCartLine(line.scaleInventoryId, { enteredUnit: u })}
                                className={`px-2.5 text-xs font-bold transition-colors ${
                                  line.enteredUnit === u ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                                }`}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">Max: {line.maxBaseQty}{line.baseUnit} in stock</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm font-semibold text-rose-500">
              {formError}
            </div>
          )}

          <button
            onClick={handleSignOut}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white font-bold transition-all active:scale-[0.98]"
          >
            {submitting ? "Signing out..." : "Sign Out Consignment"}
          </button>
        </div>
      )}

      {/* OPEN TAB */}
      {tab === "open" && (
        <div className="p-4 space-y-3">
          {openConsignments.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">No consignments currently out.</p>
            </div>
          ) : (
            openConsignments.map((c) => {
              const totalOutValue = c.scaleItems.reduce(
                (sum: number, i: any) => sum + Number(i.priceAtTime) * Number(i.quantityOut),
                0
              );

              return (
                <div key={c.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{c.recipientName}</p>
                      <p className="text-xs text-slate-500">{c.recipientPhone}</p>
                      {c.store?.name && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Store size={11} /> {c.store.name}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">OUT</span>
                  </div>
                  <div className="space-y-1.5">
                    {c.scaleItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>{item.scaleInventory?.name}</span>
                        <span>{Number(item.quantityOut)}{item.unit} · ₦{Number(item.priceAtTime).toLocaleString()}/{item.unit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500">Total value signed out</span>
                    <span className="text-sm font-bold text-amber-400">₦{totalOutValue.toLocaleString()}</span>
                  </div>
                  {settlingId === c.id ? (
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {c.scaleItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{item.scaleInventory?.name}</span>
                          <input
                            type="number"
                            step="0.001"
                            min={0}
                            max={Number(item.quantityOut)}
                            value={settleValues[item.id] ?? 0}
                            onChange={(e) =>
                              setSettleValues((prev) => ({
                                ...prev,
                                [item.id]: Math.max(0, Math.min(Number(item.quantityOut), parseFloat(e.target.value) || 0)),
                              }))
                            }
                            className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-2 text-sm text-[var(--text-primary)] text-center outline-none focus:border-blue-600"
                          />
                          <span className="text-[10px] text-slate-500 shrink-0">sold of {Number(item.quantityOut)}{item.unit}</span>
                        </div>
                      ))}
                      {settleError && (
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-500">
                          {settleError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setSettlingId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSettle(c)}
                          disabled={settling}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white text-xs font-semibold"
                        >
                          {settling ? "Settling..." : "Confirm Settlement"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openSettle(c)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                    >
                      Settle
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="p-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-8">No settled consignments yet.</p>
          ) : (
            history.map((c) => (
              <div key={c.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.recipientName}</p>
                    {c.store?.name && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Store size={11} /> {c.store.name}
                      </p>
                    )}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Clock size={10} /> SETTLED
                  </span>
                </div>
                {c.scaleItems.map((item: any) => (
                  <p key={item.id} className="text-xs text-slate-500">
                    {item.scaleInventory?.name}: {Number(item.quantitySold)}{item.unit} sold, {Number(item.quantityReturned)}{item.unit} returned
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}