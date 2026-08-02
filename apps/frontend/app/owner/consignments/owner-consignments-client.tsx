// FILE: apps/frontend/app/owner/consignments/owner-consignments-client.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Calendar, User, Store, RotateCcw, Plus, Minus, X, Phone, FileText, PackagePlus } from "lucide-react";
import { ownerReconcileScaleConsignmentAction, signOutConsignment } from "@/lib/consignment.actions";

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

export default function OwnerConsignmentsClient({
  consignments = [],
  enabled = false,
  inventory = [],
}: {
  consignments: any[];
  enabled?: boolean;
  inventory?: InventoryItem[];
}) {
  const [filter, setFilter] = useState<"all" | "out" | "settled">("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [reconcileMsg, setReconcileMsg] = useState<Record<number, string>>({});
  const router = useRouter();

  // Sign-out form — collapsed by default so the page still opens straight
  // to the record list, same as before this form existed.
  const [showForm, setShowForm] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientNote, setRecipientNote] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleReconcile = (id: number) => {
    startTransition(async () => {
      try {
        await ownerReconcileScaleConsignmentAction(id);
        setReconcileMsg((prev) => ({ ...prev, [id]: "Reconciled — stock returned." }));
        router.refresh();
      } catch (err: any) {
        setReconcileMsg((prev) => ({ ...prev, [id]: err?.message || "Failed to reconcile." }));
      }
    });
  };

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
    setSignOutError(null);
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setSignOutError("Recipient name and phone are required.");
      return;
    }
    if (cart.length === 0) {
      setSignOutError("Add at least one item.");
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
      setShowForm(false);
      router.refresh();
    } catch (err: any) {
      // Same UPGRADE_REQUIRED: prefix pattern used elsewhere — strip it
      // for display since the message itself is already plain-language.
      setSignOutError((err?.message || "Failed to sign out consignment.").replace(/^UPGRADE_REQUIRED:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  };

  const stores = Array.from(
    new Map((consignments || []).filter((c) => c?.store).map((c) => [c.store.id, c.store])).values()
  );

  const getTotalValue = (c: any) =>
    (c?.items || []).reduce((sum: number, i: any) => sum + Number(i.priceAtTime || 0) * (i.quantitySold || 0), 0);

  const filtered = (consignments || [])
    .filter((c) => {
      const statusMatch = filter === "all" || c.status === filter;
      const storeMatch = storeFilter === "all" || c.storeId === Number(storeFilter);
      const hasItems = Array.isArray(c.items) && c.items.length > 0; // Excludes empty items arrays
      return statusMatch && storeMatch && hasItems;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Newest first
    });

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link href="/owner/dashboard" className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] hover:bg-slate-200 hover:dark:bg-slate-800 flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Truck size={17} className="text-blue-400" /> Consignments
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            showForm ? "bg-slate-200 dark:bg-slate-800 text-[var(--text-primary)]" : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          <PackagePlus size={14} /> Sign Out
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {showForm && (
          !enabled ? (
            <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
              <PackagePlus size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Signing out yourself isn't available yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Owner sign-out needs Consignment turned on in Settings and the Max Package (or an admin override).
                Your staff can already sign consignment stock out on the Pro plan and up, even while this is off for you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                    className="px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white text-sm font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>

                {cart.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-600 italic py-2">No items added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((line) => (
                      <div key={line.inventoryId} className="flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate flex-1">{line.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => updateQty(line.inventoryId, -1)} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[var(--text-primary)]">
                            <Minus size={13} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-[var(--text-primary)]">{line.quantityOut}</span>
                          <button onClick={() => updateQty(line.inventoryId, 1)} disabled={line.quantityOut >= line.maxQuantity} className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30">
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

              {signOutError && (
                <p className="text-xs text-rose-400 text-center">{signOutError}</p>
              )}

              <button
                onClick={handleSignOut}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white font-bold transition-all active:scale-[0.98]"
              >
                {submitting ? "Signing out..." : "Sign Out Consignment"}
              </button>
            </div>
          )
        )}

        <div className="flex gap-2">
          {(["all", "out", "settled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
              }`}
            >
              {f === "all" ? "All" : f === "out" ? "Outstanding" : "Settled"}
            </button>
          ))}
        </div>

        {stores.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStoreFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                storeFilter === "all" ? "bg-slate-300 dark:bg-slate-700 text-[var(--text-primary)]" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
              }`}
            >
              All stores
            </button>
            {stores.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setStoreFilter(String(s.id))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  storeFilter === String(s.id) ? "bg-slate-300 dark:bg-slate-700 text-[var(--text-primary)]" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <Truck size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500">No consignments found.</p>
          </div>
        ) : (
          filtered.map((c, index) => {
            const items = c.items || [];
            const totalOutValue = items.reduce(
              (sum: number, i: any) => sum + Number(i.priceAtTime || 0) * (i.quantityOut || 0),
              0
            );
            const totalValue = getTotalValue(c);

            return (
              <div key={`${c.id}-${index}`} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.recipientName || "Unknown Recipient"}</p>
                    <p className="text-xs text-slate-500">{c.recipientPhone || "No phone number"}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <User size={11} /> Signed out by {c.staff?.fullName || "Staff"}
                    </p>
                    {c.store?.name && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Store size={11} /> {c.store.name}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={11} /> {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Date N/A"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                      c.status === "out"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {c.status === "out" ? "Outstanding" : "Settled"}
                  </span>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5">
                  {items.map((item: any, itemIndex: number) => (
                    <div key={`${item.id}-${itemIndex}`} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{item.inventory?.name || "Item"}</span>
                      <span>
                        {item.quantityOut}{item.unit || ""} out
                        {c.status === "settled" && ` · ${item.quantitySold || 0}${item.unit || ""} sold · ${item.quantityReturned || 0}${item.unit || ""} returned`}
                      </span>
                    </div>
                  ))}
                </div>

                {c.status === "out" && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Value signed out</span>
                      <span className="text-sm font-bold text-amber-400">₦{totalOutValue.toLocaleString()}</span>
                    </div>
                    {c.isScale && (
                      <>
                        <button
                          disabled={isPending}
                          onClick={() => handleReconcile(c.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                        >
                          <RotateCcw size={12} /> Reconcile Now
                        </button>
                        <p className="text-[10px] text-slate-500 text-center">
                          Closes today's consignment early — unsold stock returns to your inventory immediately
                          instead of waiting for the midnight reset.
                        </p>
                        {reconcileMsg[c.id] && <p className="text-[11px] text-slate-400 text-center">{reconcileMsg[c.id]}</p>}
                      </>
                    )}
                  </div>
                )}

                {c.status === "settled" && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500">Revenue from consignment</span>
                    <span className="text-sm font-bold text-emerald-400">₦{totalValue.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}