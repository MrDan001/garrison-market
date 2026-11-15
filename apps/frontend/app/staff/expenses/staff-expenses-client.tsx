"use client";
// FILE: apps/frontend/app/staff/expenses/staff-expenses-client.tsx

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Plus, X } from "lucide-react";
import { addExpenseAction, getExpensesForStaffToday } from "@/lib/expense.actions";\nimport { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

type Category = { id: number; name: string };
type ExpenseRow = {
  id: number;
  amount: number;
  note: string | null;
  createdAt: Date;
  isMine: boolean;
  category: { name: string } | null;
  loggedBy: { fullName: string | null; role: string } | null;
};
type TodayData = { expenses: ExpenseRow[]; total: number };

function formatCurrency(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function StaffExpensesClient({
  categories,
  initialData,
}: {
  categories: Category[];
  initialData: TodayData;
}) {
  const { formatCurrency, currencyCode } = useBusinessCurrency();\n  const [data, setData] = useState(initialData);
  const [showAddModal, setShowAddModal] = useState(false);

  async function refresh() {
    const result = await getExpensesForStaffToday();
    setData(result);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/staff/profile" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <CreditCard size={24} className="text-violet-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Today's Expenses</h1>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Shows everyone's expenses logged today — this list resets automatically at midnight.
        </p>

        <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl px-5 py-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Today</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{formatCurrency(data.total)}</p>
          </div>
          <p className="text-xs text-slate-400">{data.expenses.length} expense{data.expenses.length === 1 ? "" : "s"}</p>
        </div>

        {data.expenses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <CreditCard size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 text-sm">No expenses logged today yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.expenses.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 border ${
                  e.isMine
                    ? "bg-violet-500/5 border-violet-500/20"
                    : "bg-[var(--bg-surface)] border-slate-200/80 dark:border-slate-800/80"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.category?.name ?? "Uncategorized"}</p>
                    {e.note && <p className="text-xs text-slate-500 truncate">— {e.note}</p>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Logged by {e.isMine ? "you" : e.loggedBy?.fullName || "a teammate"} ·{" "}
                    {new Date(e.createdAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-sm font-bold text-rose-500 shrink-0">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-xl flex items-center justify-center transition-colors"
      >
        <Plus size={24} />
      </button>

      {showAddModal && (
        <AddExpenseModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onAdded={async () => {
            setShowAddModal(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({
  categories,
  onClose,
  onAdded,
}: {
  categories: Category[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addExpenseAction({
        categoryId: categoryId ? Number(categoryId) : undefined,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error || "Something went wrong.");
        return;
      }
      onAdded();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-[var(--bg-surface)] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-900">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Log an Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {categories.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              No categories have been set up yet — you can still log this without one, or ask your manager to add categories.
            </p>
          ) : (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">{currencyCode}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-violet-500"
            />
          </div>

          <textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 resize-none"
          />

          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {isSubmitting ? "Saving…" : "Save Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}