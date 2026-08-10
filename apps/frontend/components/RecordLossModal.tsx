"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle } from "lucide-react";
import { recordStockLossAction } from "@/lib/stock-loss-return.actions";

const REASONS = ["Damaged", "Expired", "Theft", "Spillage", "Other"] as const;

export default function RecordLossModal({
  batchId,
  remainingQty,
  onClose,
}: {
  batchId: number;
  remainingQty: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Damaged");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (qty > remainingQty) {
      setError(`Only ${remainingQty} left in this batch.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("batchId", String(batchId));
      formData.set("quantity", String(qty));
      formData.set("reason", reason);
      if (note.trim()) formData.set("note", note.trim());

      const result = await recordStockLossAction(formData);
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
            <AlertTriangle size={16} className="text-orange-500" /> Record Loss
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Quantity lost * (max {remainingQty})</label>
            <input
              type="number"
              min={1}
              max={remainingQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Reason</label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    reason === r
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/85 dark:border-slate-800/85"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none"
              placeholder="Anything else worth noting"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Recording..." : "Record Loss"}
          </button>
        </form>
      </div>
    </div>
  );
}