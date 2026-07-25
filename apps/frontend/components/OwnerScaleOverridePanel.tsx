// FILE: apps/frontend/components/OwnerScaleOverridePanel.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale, Plus, Trash2, Send, Pencil, Flame } from "lucide-react";
import { addScaleItemAction, updateScaleItemAction, deleteScaleItemAction } from "@/lib/scale-inventory.actions";
import { ownerSignOutScaleToStaffAction } from "@/lib/consignment.actions";

interface ScaleItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  costPrice: number | null;
  category: string | null;
  restockLevel: number | null;
  salesCount?: number;
}

interface StaffOption {
  id: number;
  fullName: string | null;
  email: string;
}

interface StaffStockLine {
  staffId: number;
  staffName: string;
  items: { name: string; unit: string; quantityOut: number; quantitySold: number; remaining: number }[];
}

export default function OwnerScaleOverridePanel({
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

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<"kg" | "L">("kg");
  const [newQty, setNewQty] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0] ? String(staff[0].id) : "");
  const [signOutQty, setSignOutQty] = useState<Record<number, string>>({});
  const [signOutMsg, setSignOutMsg] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim() || !newQty || !newPrice) {
      setMsg("Fill in name, starting quantity, and price.");
      return;
    }
    const fd = new FormData();
    fd.set("name", newName.trim());
    fd.set("quantity", newQty);
    fd.set("unit", newUnit);
    fd.set("costPrice", "");
    fd.set("price", newPrice);
    startTransition(async () => {
      const result = await addScaleItemAction(fd);
      if (result.success) {
        setMsg(`${newName.trim()} added.`);
        setNewName("");
        setNewQty("");
        setNewPrice("");
        setShowAdd(false);
        router.refresh();
      } else {
        setMsg(result.error);
      }
    });
  };

  const startEdit = (item: ScaleItem) => {
    setEditingId(item.id);
    setEditQty(String(item.quantity));
    setEditPrice(String(item.price));
  };

  const handleSaveEdit = (item: ScaleItem) => {
    const fd = new FormData();
    fd.set("id", String(item.id));
    fd.set("name", item.name);
    fd.set("quantity", editQty);
    fd.set("costPrice", item.costPrice != null ? String(item.costPrice) : "");
    fd.set("price", editPrice);
    fd.set("category", item.category || "");
    fd.set("restockLevel", item.restockLevel != null ? String(item.restockLevel) : "");
    startTransition(async () => {
      const result = await updateScaleItemAction(fd);
      if (result.success) {
        setEditingId(null);
        router.refresh();
      } else {
        setMsg(result.error);
      }
    });
  };

  const handleDelete = (item: ScaleItem) => {
    if (!window.confirm(`Remove ${item.name} from scale inventory?`)) return;
    const fd = new FormData();
    fd.set("id", String(item.id));
    startTransition(async () => {
      await deleteScaleItemAction(fd);
      router.refresh();
    });
  };

  const handleSignOut = () => {
    if (!selectedStaffId) {
      setSignOutMsg("Choose a staff member first.");
      return;
    }
    const lines = Object.entries(signOutQty)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([id, v]) => ({ scaleInventoryId: Number(id), enteredQty: parseFloat(v), enteredUnit: items.find((i) => i.id === Number(id))!.unit }));

    if (lines.length === 0) {
      setSignOutMsg("Enter a quantity for at least one item.");
      return;
    }

    startTransition(async () => {
      try {
        await ownerSignOutScaleToStaffAction({ staffId: Number(selectedStaffId), items: lines });
        setSignOutMsg("Signed out to staff — it'll appear in their scale inventory now.");
        setSignOutQty({});
        router.refresh();
      } catch (err: any) {
        setSignOutMsg(err?.message || "Failed to sign out.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-teal-500" />
        <h2 className="text-sm font-bold text-[var(--text-primary)]">Scale Inventory (Daily Consignment)</h2>
      </div>
      <p className="text-[11px] text-slate-500 -mt-3">
        Standard inventory above is unaffected. Scale stock only reaches staff once you sign it out below — it
        resets automatically at midnight, and unsold stock returns here for you to sign out fresh the next day.
      </p>

      {/* Best Sellers */}
      {items.some((i) => (i.salesCount ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2">
          {[...items]
            .sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0))
            .filter((i) => (i.salesCount ?? 0) > 0)
            .slice(0, 3)
            .map((i) => (
              <span
                key={i.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400"
              >
                <Flame size={10} fill="currentColor" /> {i.name} · {i.salesCount}
                {i.unit} sold
              </span>
            ))}
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-slate-500">No scale products yet.</p>}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800"
          >
            {editingId === item.id ? (
              <>
                <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[100px]">{item.name}</span>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  placeholder={`Qty (${item.unit})`}
                />
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  placeholder="Price"
                />
                <button
                  disabled={isPending}
                  onClick={() => handleSaveEdit(item)}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 rounded-lg text-[11px] font-bold text-white"
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-slate-800 rounded-lg text-[11px] text-slate-300">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                    {item.name}
                    {(item.salesCount ?? 0) > 0 && <Flame size={11} className="text-amber-500" fill="currentColor" />}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.quantity}
                    {item.unit} in stock · ₦{item.price}/{item.unit}
                    {(item.salesCount ?? 0) > 0 && ` · ${item.salesCount}${item.unit} sold`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300">
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      {showAdd ? (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <input
            type="text"
            placeholder="Product name (e.g. Rice)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Starting qty"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
            />
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as "kg" | "L")}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200"
            >
              <option value="kg">kg</option>
              <option value="L">L</option>
            </select>
            <input
              type="number"
              placeholder="Price per unit"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
            />
          </div>
          <div className="flex gap-2">
            <button disabled={isPending} onClick={handleAdd} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs font-bold text-white">
              Save Item
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-[11px] font-semibold text-white"
        >
          <Plus size={13} /> Add scale item
        </button>
      )}
      {msg && <p className="text-[11px] text-slate-400">{msg}</p>}

      {/* Staff stock levels — so it's obvious who's low/out and needs a top-up */}
      {staffStock.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-400">Staff stock levels (today)</p>
          {staffStock.map((s) => {
            const totalRemaining = s.items.reduce((sum, i) => sum + i.remaining, 0);
            const isOut = totalRemaining <= 0;
            const isLow = !isOut && s.items.some((i) => i.quantityOut > 0 && i.remaining / i.quantityOut <= 0.2);
            return (
              <div key={s.staffId} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{s.staffName}</span>
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
                    onClick={() => setSelectedStaffId(String(s.staffId))}
                    className="text-[11px] font-semibold text-blue-500 hover:text-blue-400"
                  >
                    Top up this staff member →
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
        ) : (
          <>
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
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 flex-1">{item.name}</span>
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
              <Send size={13} /> Sign Out to Staff
            </button>
            {signOutMsg && <p className="text-[11px] text-slate-400">{signOutMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}