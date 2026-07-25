// FILE: apps/frontend/app/staff/inventory/staff-scale-live-sell.tsx (NEW FILE)

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Clock, CheckCircle2 } from "lucide-react";
import { sellFromScaleConsignmentAction } from "@/lib/consignment.actions";

interface ConsignmentLine {
  id: number; // ScaleConsignmentItem id
  name: string;
  unit: string;
  quantityOut: number;
  quantitySold: number;
  priceAtTime: number; // per base unit
}

export default function StaffScaleLiveSell({
  openConsignments,
  history,
}: {
  openConsignments: any[];
  history: any[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"sell" | "history">("sell");
  const [isPending, startTransition] = useTransition();
  const [qty, setQty] = useState<Record<number, string>>({});
  const [payment, setPayment] = useState<"cash" | "transfer">("cash");
  const [msg, setMsg] = useState<string | null>(null);

  const lines: ConsignmentLine[] = openConsignments.flatMap((c) =>
    c.scaleItems.map((i: any) => ({
      id: i.id,
      name: i.scaleInventory?.name ?? "Item",
      unit: i.unit,
      quantityOut: Number(i.quantityOut),
      quantitySold: Number(i.quantitySold),
      priceAtTime: Number(i.priceAtTime),
    }))
  );

  const handleSell = (line: ConsignmentLine) => {
    const enteredQty = parseFloat(qty[line.id] || "0");
    if (!enteredQty || enteredQty <= 0) {
      setMsg("Enter a quantity first.");
      return;
    }
    const remaining = line.quantityOut - line.quantitySold;
    if (enteredQty > remaining) {
      setMsg(`Only ${remaining}${line.unit} of ${line.name} left today.`);
      return;
    }
    startTransition(async () => {
      try {
        await sellFromScaleConsignmentAction(
          [{ consignmentItemId: line.id, enteredQty, enteredUnit: line.unit, price: line.priceAtTime }],
          payment
        );
        setMsg(`Sold ${enteredQty}${line.unit} of ${line.name}.`);
        setQty((prev) => ({ ...prev, [line.id]: "" }));
        router.refresh();
      } catch (err: any) {
        setMsg(err?.message || "Sale failed.");
      }
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView("sell")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            view === "sell" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
          }`}
        >
          Sell
        </button>
        <button
          onClick={() => setView("history")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            view === "history" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
          }`}
        >
          History
        </button>
      </div>

      {view === "sell" && (
        <>
          {lines.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
              <ShoppingCart size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">Nothing has been signed out to you yet today.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-1">
                {(["cash", "transfer"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPayment(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize ${
                      payment === p ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {lines.map((line) => {
                const remaining = line.quantityOut - line.quantitySold;
                return (
                  <div key={line.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{line.name}</p>
                      <span className="text-xs text-slate-500">
                        {remaining}
                        {line.unit} left · ₦{line.priceAtTime.toLocaleString()}/{line.unit}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        max={remaining}
                        placeholder={`Qty (${line.unit})`}
                        value={qty[line.id] || ""}
                        onChange={(e) => setQty((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-[var(--text-primary)] outline-none focus:border-blue-600"
                      />
                      <button
                        disabled={isPending || remaining <= 0}
                        onClick={() => handleSell(line)}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold"
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {msg && <p className="text-xs text-slate-400">{msg}</p>}
        </>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-8">No settled days yet.</p>
          ) : (
            history.map((c) => (
              <div key={c.id} className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {new Date(c.date ?? c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
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