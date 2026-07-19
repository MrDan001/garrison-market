import { ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";

export default function ExpensesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/owner/profile" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 w-fit transition-colors">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <CreditCard size={24} className="text-violet-500" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Expenses</h1>
        </div>
        <div className="p-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <CreditCard size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Coming Soon</p>
          <p className="text-slate-400 dark:text-slate-600 text-sm mt-1">Expense tracking will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
}