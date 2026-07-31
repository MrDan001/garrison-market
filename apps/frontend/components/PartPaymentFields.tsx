"use client";
// components/PartPaymentFields.tsx
//
// The "Paid in full / Part payment" toggle + amount-received input used at
// checkout on every sale screen (list, scale, merged). Picking "Part
// payment" is what turns a sale into a Debt (see processSaleAction /
// processScaleSaleAction / processMergedSaleAction) — this component only
// handles the UI state, the server actions re-validate everything.

interface PartPaymentFieldsProps {
  paymentStatus: "full" | "partial";
  onPaymentStatusChange: (status: "full" | "partial") => void;
  amountPaid: string;
  onAmountPaidChange: (value: string) => void;
  total: number;
}

export default function PartPaymentFields({
  paymentStatus,
  onPaymentStatusChange,
  amountPaid,
  onAmountPaidChange,
  total,
}: PartPaymentFieldsProps) {
  const parsed = parseFloat(amountPaid);
  const valid = !isNaN(parsed) && parsed >= 0 && parsed < total;

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Amount Received</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => {
            onPaymentStatusChange("full");
            onAmountPaidChange("");
          }}
          className={`py-3 rounded-xl text-sm font-bold transition-colors ${
            paymentStatus === "full"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          ✅ Paid in full
        </button>
        <button
          type="button"
          onClick={() => onPaymentStatusChange("partial")}
          className={`py-3 rounded-xl text-sm font-bold transition-colors ${
            paymentStatus === "partial"
              ? "bg-amber-600 text-white"
              : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
          }`}
        >
          🕒 Part payment
        </button>
      </div>

      {paymentStatus === "partial" && (
        <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <label className="text-xs text-slate-600 dark:text-slate-400">Amount paid now (₦)</label>
          <input
            type="number"
            min={0}
            max={total}
            placeholder="0"
            value={amountPaid}
            onChange={(e) => onAmountPaidChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <p className="text-xs text-amber-500 font-medium">
            {valid ? `Balance owed: ₦${(total - parsed).toLocaleString()}` : "Enter an amount less than the total."}
          </p>
        </div>
      )}
    </div>
  );
}

// Shared validation used right before calling the sale action — mirrors
// the server-side check in each *SaleAction so the button/error message
// can catch the same problems before the request even goes out.
export function validatePartPayment(
  paymentStatus: "full" | "partial",
  amountPaidInput: string,
  total: number,
  customerName: string,
  customerPhone: string
): string | null {
  if (paymentStatus !== "partial") return null;
  if (!customerName.trim() || !customerPhone.trim()) {
    return "Customer name and phone number are required for a part payment.";
  }
  const amount = parseFloat(amountPaidInput);
  if (isNaN(amount) || amount < 0) {
    return "Enter a valid amount paid.";
  }
  if (amount >= total) {
    return 'Amount paid covers the full total — select "Paid in full" instead.';
  }
  return null;
}