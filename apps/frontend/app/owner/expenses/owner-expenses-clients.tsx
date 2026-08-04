"use client";
// FILE: apps/frontend/app/owner/expenses/owner-expenses-client.tsx

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Tag,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  addExpenseAction,
  createExpenseCategoryAction,
  renameExpenseCategoryAction,
  deleteExpenseCategoryAction,
  getExpensesForOwner,
} from "@/lib/expense.actions";

type Category = { id: number; name: string };
type ExpenseRow = {
  id: number;
  amount: unknown;
  note: string | null;
  createdAt: Date;
  category: { name: string } | null;
  loggedBy: { fullName: string | null; role: string } | null;
};
type PeriodData = { expenses: ExpenseRow[]; total: number; count: number; label: string };
type Overview = {
  today: { total: number; count: number };
  month: { total: number; count: number; label: string };
  year: { total: number; count: number; label: string };
} | null;
type Period = "day" | "month" | "year";

function naira(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function OwnerExpensesClient({
  categories: initialCategories,
  overview,
  initialPeriod,
  initialData,
}: {
  categories: Category[];
  overview: Overview;
  initialPeriod: Period;
  initialData: PeriodData;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<PeriodData>(initialData);
  const [isPending, startTransition] = useTransition();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  function fetchPeriod(nextPeriod: Period, nextDate: Date) {
    startTransition(async () => {
      const result = await getExpensesForOwner(nextPeriod, nextDate.toISOString());
      setData(result);
    });
  }

  function changePeriod(next: Period) {
    setPeriod(next);
    fetchPeriod(next, referenceDate);
  }

  function navigate(direction: -1 | 1) {
    const next = new Date(referenceDate);
    if (period === "day") next.setDate(next.getDate() + direction);
    if (period === "month") next.setMonth(next.getMonth() + direction);
    if (period === "year") next.setFullYear(next.getFullYear() + direction);
    setReferenceDate(next);
    fetchPeriod(period, next);
  }

  function jumpToToday() {
    const now = new Date();
    setReferenceDate(now);
    fetchPeriod(period, now);
  }

  function refreshCurrentPeriod() {
    fetchPeriod(period, referenceDate);
  }

  const isCurrentPeriod = (() => {
    const now = new Date();
    if (period === "day") return now.toDateString() === referenceDate.toDateString();
    if (period === "month") return now.getMonth() === referenceDate.getMonth() && now.getFullYear() === referenceDate.getFullYear();
    return now.getFullYear() === referenceDate.getFullYear();
  })();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/owner/profile" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] w-fit transition-colors text-sm font-semibold">
            <ArrowLeft size={18} /> Back
          </Link>
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-violet-500 transition-colors"
          >
            <Tag size={13} /> Manage Categories
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <CreditCard size={24} className="text-violet-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Expenses</h1>
        </div>

        {/* Overview cards */}
        {overview && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">Today</p>
              <p className="text-base sm:text-xl font-black text-[var(--text-primary)] mt-1 truncate">{naira(overview.today.total)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{overview.today.count} logged</p>
            </div>
            <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">This Month</p>
              <p className="text-base sm:text-xl font-black text-[var(--text-primary)] mt-1 truncate">{naira(overview.month.total)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{overview.month.count} logged</p>
            </div>
            <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">This Year</p>
              <p className="text-base sm:text-xl font-black text-[var(--text-primary)] mt-1 truncate">{naira(overview.year.total)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{overview.year.count} logged</p>
            </div>
          </div>
        )}

        {/* Period tabs */}
        <div className="flex gap-2 mb-3">
          {(["day", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-colors ${
                period === p
                  ? "bg-violet-600/10 border-violet-500/30 text-violet-500"
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-3 py-2.5 mb-4">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--text-primary)]">{data.label}</p>
            {!isCurrentPeriod && (
              <button onClick={jumpToToday} className="text-[11px] font-semibold text-violet-500 hover:text-violet-600">
                Jump to today
              </button>
            )}
          </div>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Period total */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs font-semibold text-slate-500">{data.count} expense{data.count === 1 ? "" : "s"}</p>
          <p className="text-sm font-black text-[var(--text-primary)]">{naira(data.total)}</p>
        </div>

        {/* List */}
        {isPending ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : data.expenses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <CreditCard size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 text-sm">No expenses logged for this {period}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.expenses.map((e) => (
              <div key={e.id} className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.category?.name ?? "Uncategorized"}</p>
                    {e.note && <p className="text-xs text-slate-500 truncate">— {e.note}</p>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Logged by {e.loggedBy?.fullName || (e.loggedBy?.role === "owner" ? "You" : "Staff")} ·{" "}
                    {new Date(e.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-sm font-bold text-rose-500 shrink-0">{naira(Number(e.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating add button */}
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
          onAdded={() => {
            setShowAddModal(false);
            refreshCurrentPeriod();
          }}
        />
      )}

      {showCategoriesModal && (
        <ManageCategoriesModal
          categories={categories}
          onClose={() => setShowCategoriesModal(false)}
          onChange={setCategories}
        />
      )}
    </div>
  );
}

// ============================================================================
// Add Expense modal
// ============================================================================
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

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">₦</span>
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

// ============================================================================
// Manage Categories modal — owner only (this whole page is owner-only, so
// no extra role check needed here beyond what the server actions already
// enforce).
// ============================================================================
function ManageCategoriesModal({
  categories,
  onClose,
  onChange,
}: {
  categories: Category[];
  onClose: () => void;
  onChange: (categories: Category[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    setIsBusy(true);
    try {
      const result = await createExpenseCategoryAction(newName.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange([...categories, result.category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRename(id: number) {
    if (!editingName.trim()) return;
    setError(null);
    setIsBusy(true);
    try {
      const result = await renameExpenseCategoryAction(id, editingName.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange(
        categories
          .map((c) => (c.id === id ? { ...c, name: editingName.trim() } : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    setIsBusy(true);
    try {
      const result = await deleteExpenseCategoryAction(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChange(categories.filter((c) => c.id !== id));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-[var(--bg-surface)] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-900 shrink-0">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Manage Categories</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-2 overflow-y-auto">
          {categories.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No categories yet — add one below.</p>}

          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(ev) => setEditingName(ev.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                  />
                  <button onClick={() => handleRename(c.id)} disabled={isBusy} className="text-xs font-bold text-violet-500">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-slate-400">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                  <button
                    onClick={() => { setEditingId(c.id); setEditingName(c.name); }}
                    className="text-slate-400 hover:text-violet-500 p-1"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={isBusy}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="p-5 pt-3 border-t border-slate-100 dark:border-slate-900 shrink-0 space-y-2">
          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={isBusy || !newName.trim()}
              className="flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-xs px-4 rounded-xl transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}