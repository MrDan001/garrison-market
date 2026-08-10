"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, PackageMinus } from "lucide-react";
import { recordScaleStockReturnAction } from "@/lib/stock-loss-return-scale.actions";

export default function RecordScaleReturnModal({
  batchId,
  unit,
  remainingQty,
  onClose,
}: {
  batchId: number;
  unit: string;
  remainingQty: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (qty > remainingQty) {
      setError(`Only ${remainingQty}${unit} left in this batch.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("batchId", String(batchId));
      formData.set("quantity", String(qty));
      if (supplierName.trim()) formData.set("supplierName", supplierName.trim());
      if (reason.trim()) formData.set("reason", reason.trim());
      if (refundAmount) formData.set("refundAmount", refundAmount);

      const result = await recordScaleStockReturnAction(formData);
      if (!result.success) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[var(--bg-app)] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <PackageMinus size={16} className="text-blue-500" /> Supplier Return
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Quantity returned ({unit}) * (max {remainingQty}{unit})</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={remainingQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Supplier (optional)</label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Who it's going back to"
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Short-dated, wrong delivery"
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Refund amount (optional)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="What the supplier credited back, if any"
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Recording..." : "Record Return"}
          </button>
        </form>
      </div>
    </div>
  );
}