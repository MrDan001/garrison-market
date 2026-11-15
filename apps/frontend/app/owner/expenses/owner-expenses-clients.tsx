"use client";
// FILE: apps/frontend/app/owner/expenses/owner-expenses-client.tsx

import { useState, useTransition, useEffect } from "react";
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
  Calendar,
  TrendingDown,
  Layers,
  UserCheck,
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

function formatCurrency(n: number) {
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
  const { formatCurrency, currencyCode } = useBusinessCurrency();\n  const [categories, setCategories] = useState(initialCategories);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [data, setData] = useState<PeriodData>(initialData);
  const [isPending, startTransition] = useTransition();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // Carousel state
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!overview) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 5000);

    return () => clearInterval(interval);
  }, [overview]);

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

  const slides = overview
    ? [
        {
          label: "Today's Outgoings",
          amount: overview.today.total,
          count: overview.today.count,
          icon: TrendingDown,
          bgGrad: "from-violet-600 to-indigo-600",
          iconColor: "text-rose-200",
        },
        {
          label: "This Month's Outgoings",
          amount: overview.month.total,
          count: overview.month.count,
          icon: Calendar,
          bgGrad: "from-indigo-600 to-slate-800",
          iconColor: "text-indigo-200",
        },
        {
          label: "This Year's Outgoings",
          amount: overview.year.total,
          count: overview.year.count,
          icon: Layers,
          bgGrad: "from-purple-700 to-violet-900",
          iconColor: "text-violet-200",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-28">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between">
          <Link 
            href="/owner/profile" 
            className="group flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors text-sm font-semibold px-2 py-1 rounded-lg"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" /> Back
          </Link>
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-xl transition-all border border-violet-500/20"
          >
            <Tag size={13} /> Manage Categories
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600/10 text-violet-500 flex items-center justify-center shrink-0">
            <CreditCard size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Expenses</h1>
            <p className="text-xs text-slate-400 font-medium">Track and manage store operational outgoings</p>
          </div>
        </div>

        {/* Carousel Banner */}
        {overview && slides.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {slides.map((slide, index) => {
                const IconComponent = slide.icon;
                return (
                  <div
                    key={index}
                    className={`w-full shrink-0 bg-gradient-to-r ${slide.bgGrad} p-5 sm:p-6 text-white flex flex-col justify-between min-h-[140px]`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                        {slide.label}
                      </span>
                      <span className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                        <IconComponent size={18} className={slide.iconColor} />
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-2xl sm:text-3xl font-black tracking-tight">
                        {formatCurrency(slide.amount)}
                      </p>
                      <p className="text-xs font-medium text-white/80 mt-1">
                        {slide.count} expense record{slide.count === 1 ? "" : "s"} logged
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slide Indicators */}
            <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeSlide === i ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filter & Date Bar */}
        <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            
            {/* Period selector */}
            <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl w-full sm:w-auto">
              {(["day", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => changePeriod(p)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                    period === p
                      ? "bg-[var(--bg-surface)] text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Date Nav */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={() => navigate(-1)} 
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center px-1">
                <p className="text-xs font-bold text-[var(--text-primary)] min-w-[90px]">{data.label}</p>
                {!isCurrentPeriod && (
                  <button onClick={jumpToToday} className="text-[10px] font-semibold text-violet-500 hover:underline">
                    Jump to today
                  </button>
                )}
              </div>
              <button 
                onClick={() => navigate(1)} 
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Period Total */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 px-1">
            <span className="text-xs font-medium text-slate-400">
              <span className="text-slate-700 dark:text-slate-200 font-bold">{data.count}</span> expense{data.count === 1 ? "" : "s"}
            </span>
            <span className="text-sm font-black text-rose-500">
              {formatCurrency(data.total)}
            </span>
          </div>
        </div>

        {/* Expenses List */}
        {isPending ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-violet-500" />
            <p className="text-xs text-slate-400 font-medium">Fetching expenses...</p>
          </div>
        ) : data.expenses.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]">
            <CreditCard size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 text-xs">No expenses logged for this {period}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.expenses.map((e) => (
              <div 
                key={e.id} 
                className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {e.category?.name ?? "Uncategorized"}
                    </p>
                    {e.note && (
                      <span className="text-xs text-slate-400 truncate">
                        — {e.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-medium">
                    <UserCheck size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {e.loggedBy?.fullName || (e.loggedBy?.role === "owner" ? "You" : "Staff")}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(e.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-rose-500">{formatCurrency(Number(e.amount))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={24} />
      </button>

      {/* Add Modal */}
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

      {/* Categories Modal */}
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
// Add Expense Modal
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
      <div className="w-full sm:max-w-sm bg-[var(--bg-surface)] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Log New Expense</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-violet-500"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">{currencyCode}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note (Optional)</label>
            <textarea
              placeholder="What was this expense for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-medium focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-violet-600/20"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Save Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Manage Categories Modal
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
      <div className="w-full sm:max-w-sm bg-[var(--bg-surface)] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Manage Expense Categories</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-2 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No categories created yet.</p>
          )}

          {categories.map((c) => (
            <div 
              key={c.id} 
              className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-3 py-2"
            >
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(ev) => setEditingName(ev.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleRename(c.id)} 
                      disabled={isBusy} 
                      className="text-xs font-bold text-violet-600 dark:text-violet-400 px-1.5 py-0.5"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingId(null)} 
                      className="text-xs font-medium text-slate-400 px-1 py-0.5"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingId(c.id); setEditingName(c.name); }}
                      className="text-slate-400 hover:text-violet-500 p-1 rounded-lg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isBusy}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="p-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 shrink-0 space-y-2">
          {error && <p className="text-xs font-semibold text-rose-500 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">{error}</p>}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-medium focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={isBusy || !newName.trim()}
              className="flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-xs px-3.5 rounded-xl transition-colors shadow-md shadow-violet-600/20"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}