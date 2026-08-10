"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { addStockToScaleInventoryAction } from "@/lib/scale-inventory.actions";

interface Props {
  itemId: number;
  itemName: string;
  unit: string;
  currentQuantity: number;
  currentPrice: number;
  currentCostPrice: number | null;
  trackExpiry: boolean;
}

export default function AddScaleStockForm({
  itemId,
  itemName,
  unit,
  currentQuantity,
  currentPrice,
  currentCostPrice,
  trackExpiry,
}: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>(currentCostPrice != null ? String(currentCostPrice) : "");
  const [sellingPrice, setSellingPrice] = useState<string>(String(currentPrice));
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Enter a valid quantity to add.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("scaleInventoryId", String(itemId));
      formData.set("quantity", String(qty));
      if (costPrice) formData.set("costPrice", costPrice);
      if (sellingPrice) formData.set("sellingPrice", sellingPrice);
      if (trackExpiry && expiryDate) formData.set("expiryDate", expiryDate);
      formData.set("paymentMethod", paymentMethod);

      const result = await addStockToScaleInventoryAction(formData);
      if (!result.success) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }
      router.push(`/owner/inventory/${itemId}?type=scale`);
    } catch (err: any) {
      console.error("Add stock failed:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-10">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Add Stock</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Package size={11} /> {itemName} · currently {currentQuantity}{unit} in stock
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Quantity to add ({unit}) *</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`e.g. 50${unit}`}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Cost price (per {unit})</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Optional"
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Selling price (per {unit})</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 -mt-2">
            Leave selling price as-is to keep the product's current price. A different price here only changes what
            this batch is remembered as having sold for — the product's live price updates too.
          </p>

          {trackExpiry && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Expiry date for this batch</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Paid for by</label>
            <div className="flex gap-2">
              {(["cash", "transfer"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
                    paymentMethod === m
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Adding stock..." : "Add Stock"}
          </button>
        </form>
      </div>
    </div>
  );
}