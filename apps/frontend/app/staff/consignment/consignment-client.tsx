"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Package, Plus, Minus, X, Truck,
  User, Phone, FileText, CheckCircle2, Clock,
} from "lucide-react";
import { signOutConsignment, settleConsignment } from "@/lib/consignment.actions";

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface CartLine {
  inventoryId: number;
  name: string;
  quantityOut: number;
  maxQuantity: number;
}

export default function StaffConsignmentClient({
  enabled,
  inventory,
  openConsignments,
  history,
}: {
  enabled: boolean;
  inventory: InventoryItem[];
  openConsignments: any[];
  history: any[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"new" | "open" | "history">(openConsignments.length > 0 ? "open" : "new");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientNote, setRecipientNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleValues, setSettleValues] = useState<Record<number, number>>({}); // itemId -> quantitySold
  const [settling, setSettling] = useState(false);

  if (!enabled) {
    return (
      <div className="min-h-screen bg-[#0A0C12] text-slate-200 flex flex-col items-center justify-center px-6 text-center">
        <Truck size={40} className="text-slate-700 mb-4" />
        <h1 className="text-lg font-bold text-white mb-1">Consignment isn't enabled</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          Ask your store owner to turn on consignment access in settings before you can sign out goods.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
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
    if (cart.find((c) => c.inventoryId === inv.id)) return;

    setCart((prev) => [
      ...prev,
      { inventoryId: inv.id, name: inv.name, quantityOut: 1, maxQuantity: inv.quantity },
    ]);
    setSelectedItemId("");
  };

  const updateQty = (inventoryId: number, delta: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.inventoryId === inventoryId
          ? { ...c, quantityOut: Math.max(1, Math.min(c.maxQuantity, c.quantityOut + delta)) }
          : c
      )
    );
  };

  const removeFromCart = (inventoryId: number) => {
    setCart((prev) => prev.filter((c) => c.inventoryId !== inventoryId));
  };

  const handleSignOut = async () => {
    if (!recipientName.trim() || !recipientPhone.trim()) {
      alert("Recipient name and phone are required.");
      return;
    }
    if (cart.length === 0) {
      alert("Add at least one item.");
      return;
    }

    setSubmitting(true);
    try {
      await signOutConsignment({
        recipientName,
        recipientPhone,
        recipientNote,
        items: cart.map((c) => ({ inventoryId: c.inventoryId, quantityOut: c.quantityOut })),
      });
      setRecipientName("");
      setRecipientPhone("");
      setRecipientNote("");
      setCart([]);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to sign out consignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openSettle = (consignment: any) => {
    setSettlingId(consignment.id);
    const initial: Record<number, number> = {};
    consignment.items.forEach((item: any) => {
      initial[item.id] = item.quantityOut; // default: assume all sold, staff adjusts
    });
    setSettleValues(initial);
  };

  const handleSettle = async (consignment: any) => {
    setSettling(true);
    try {
      const settlements = consignment.items.map((item: any) => {
        const sold = settleValues[item.id] ?? 0;
        return {
          itemId: item.id,
          quantitySold: sold,
          quantityReturned: item.quantityOut - sold,
        };
      });
      await settleConsignment(consignment.id, settlements);
      setSettlingId(null);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to settle consignment.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C12] text-slate-200 pb-24">
      <div className="sticky top-0 z-20 bg-[#0a0c12]/90 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          <Truck size={18} className="text-blue-400" /> Consignment
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4">
        {(["new", "open", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {t === "new" ? "Sign Out" : t === "open" ? `Open (${openConsignments.length})` : "History"}
          </button>
        ))}
      </div>

      {/* NEW SIGN-OUT TAB */}
      {tab === "new" && (
        <div className="p-4 space-y-4">
          <div className="bg-[#11131A] border border-slate-800 rounded-2xl p-4 space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recipient</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Recipient name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            <div className="relative">
              <FileText size={15} className="absolute left-3 top-3 text-slate-500" />
              <textarea
                value={recipientNote}
                onChange={(e) => setRecipientNote(e.target.value)}
                placeholder="Note (optional) — address, agreement details, etc."
                className="w-full h-16 bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-600 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="bg-[#11131A] border border-slate-800 rounded-2xl p-4 space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items to Sign Out</label>
            <div className="flex gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-blue-600 transition-colors"
              >
                <option value="">Select an item...</option>
                {inventory
                  .filter((inv) => inv.quantity > 0 && !cart.find((c) => c.inventoryId === inv.id))
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.quantity} in stock)
                    </option>
                  ))}
              </select>
              <button
                onClick={addItemToCart}
                disabled={!selectedItemId}
                className="px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold transition-colors"
              >
                Add
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-600 italic py-2">No items added yet.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div key={line.inventoryId} className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <p className="text-sm text-slate-200 truncate flex-1">{line.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => updateQty(line.inventoryId, -1)} className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-white">
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-white">{line.quantityOut}</span>
                      <button onClick={() => updateQty(line.inventoryId, 1)} disabled={line.quantityOut >= line.maxQuantity} className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-white disabled:opacity-30">
                        <Plus size={13} />
                      </button>
                      <button onClick={() => removeFromCart(line.inventoryId)} className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold transition-all active:scale-[0.98]"
          >
            {submitting ? "Signing out..." : "Sign Out Consignment"}
          </button>
        </div>
      )}

      {/* OPEN TAB */}
      {tab === "open" && (
        <div className="p-4 space-y-3">
          {openConsignments.length === 0 ? (
            <div className="bg-[#11131A] border border-dashed border-slate-800 rounded-2xl p-10 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-700" />
              <p className="text-sm text-slate-500">No consignments currently out.</p>
            </div>
          ) : (
            openConsignments.map((c) => (
              <div key={c.id} className="bg-[#11131A] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{c.recipientName}</p>
                    <p className="text-xs text-slate-500">{c.recipientPhone}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">OUT</span>
                </div>
                <div className="space-y-1.5">
                  {c.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-400">
                      <span>{item.inventory?.name}</span>
                      <span>{item.quantityOut} units · ₦{Number(item.priceAtTime).toLocaleString()} each</span>
                    </div>
                  ))}
                </div>
                {settlingId === c.id ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    {c.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-300 flex-1 truncate">{item.inventory?.name}</span>
                        <input
                          type="number"
                          min={0}
                          max={item.quantityOut}
                          value={settleValues[item.id] ?? 0}
                          onChange={(e) =>
                            setSettleValues((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, Math.min(item.quantityOut, Number(e.target.value))),
                            }))
                          }
                          className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-sm text-white text-center outline-none focus:border-blue-600"
                        />
                        <span className="text-[10px] text-slate-500 shrink-0">sold of {item.quantityOut}</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => setSettlingId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSettle(c)}
                        disabled={settling}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold"
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
            ))
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="p-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-600 italic text-center py-8">No settled consignments yet.</p>
          ) : (
            history.map((c) => (
              <div key={c.id} className="bg-[#11131A] border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{c.recipientName}</p>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Clock size={10} /> SETTLED
                  </span>
                </div>
                {c.items.map((item: any) => (
                  <p key={item.id} className="text-xs text-slate-500">
                    {item.inventory?.name}: {item.quantitySold} sold, {item.quantityReturned} returned
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