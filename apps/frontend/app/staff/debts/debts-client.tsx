"use client";

import { useState } from "react";
import {
  ArrowLeft, HandCoins, ChevronDown, User, Phone, Package, X, Clock,
} from "lucide-react";
import Link from "next/link";
import { recordDebtPaymentAction } from "@/lib/debt.actions";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

interface DebtItem {
  id: number;
  quantity: number;
  priceAtTime: number;
  inventory: { name: string } | null;
}

interface DebtScaleItem {
  id: number;
  quantity: number;
  unit: string;
  priceAtTime: number;
  scaleInventory: { name: string } | null;
}

interface DebtPaymentType {
  id: number;
  amount: number;
  createdAt: string;
  staff: { fullName: string | null } | null;
}

interface DebtType {
  id: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string };
  order: {
    id: number;
    date: string;
    items: DebtItem[];
    scaleItems: DebtScaleItem[];
    staff: { fullName: string | null } | null;
  };
  payments: DebtPaymentType[];
}

// A debt's order can be a plain "list" sale, a scale sale, or a merged mix
// of both — this flattens both item shapes into one line format for
// display. List lines total = priceAtTime × quantity; scale lines store
// priceAtTime as the line's total already (matches the convention
// order-history-client.tsx uses for the same two relations).
function saleLines(order: DebtType["order"]) {
  const list = order.items.map((i) => ({
    key: `list-${i.id}`,
    name: i.inventory?.name || "Deleted item",
    qtyLabel: `× ${i.quantity}`,
    total: i.priceAtTime * i.quantity,
  }));
  const scale = order.scaleItems.map((i) => ({
    key: `scale-${i.id}`,
    name: i.scaleInventory?.name || "Deleted item",
    qtyLabel: `${i.quantity}${i.unit}`,
    total: i.priceAtTime,
  }));
  return [...list, ...scale];
}

export default function DebtsClient({ debts: initialDebts }: { debts: DebtType[] }) {
  const { formatCurrency, currencyCode } = useBusinessCurrency();
  const [debts, setDebts] = useState(initialDebts);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payingDebt, setPayingDebt] = useState<DebtType | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [loading, setLoading] = useState(false);

  const totalOwed = debts.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0);

  const openPayModal = (debt: DebtType) => {
    setPayingDebt(debt);
    setAmountInput("");
    setPayMethod("cash");
  };

  const handleLogPayment = async () => {
    if (!payingDebt) return;
    const remaining = payingDebt.totalAmount - payingDebt.amountPaid;
    const amount = parseFloat(amountInput);

    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }
    if (amount > remaining) {
      alert(`That's more than what's owed (${formatCurrency(remaining)} remaining).`);
      return;
    }

    setLoading(true);
    try {
      const result = await recordDebtPaymentAction(payingDebt.id, amount, payMethod);
      if (result.settled) {
        // Fully paid off — drop it from the open list.
        setDebts((prev) => prev.filter((d) => d.id !== payingDebt.id));
      } else {
        setDebts((prev) =>
          prev.map((d) =>
            d.id === payingDebt.id ? { ...d, amountPaid: d.amountPaid + amount } : d
          )
        );
      }
      setPayingDebt(null);
      setAmountInput("");
      alert(result.settled ? "Debt fully settled!" : "Payment logged.");
    } catch (error: any) {
      alert(error.message || "Failed to log payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-3">
        <Link href="/staff/dashboard" className="p-2 -ml-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Debtors</h1>
          <p className="text-xs text-slate-500">Customers who owe a balance from part payments</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-500 font-semibold uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(totalOwed)}</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <HandCoins size={20} className="text-amber-500" />
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="p-12 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/10 dark:bg-slate-900/10">
            <HandCoins size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No open debts</p>
            <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Every part payment has been settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => {
              const remaining = debt.totalAmount - debt.amountPaid;
              const isExpanded = expandedId === debt.id;

              return (
                <div
                  key={debt.id}
                  className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : debt.id)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-500 shrink-0" />
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{debt.customer.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone size={11} className="text-slate-500 shrink-0" />
                        <p className="text-xs text-slate-500">{debt.customer.phone}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {new Date(debt.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Owed</p>
                        <p className="text-base font-bold text-amber-500">{formatCurrency(remaining)}</p>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50/60 dark:bg-slate-950/60 rounded-xl p-2">
                          <p className="text-[10px] text-slate-500">Total</p>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{formatCurrency(debt.totalAmount)}</p>
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-950/60 rounded-xl p-2">
                          <p className="text-[10px] text-slate-500">Paid</p>
                          <p className="text-xs font-bold text-emerald-500">{formatCurrency(debt.amountPaid)}</p>
                        </div>
                        <div className="bg-slate-50/60 dark:bg-slate-950/60 rounded-xl p-2">
                          <p className="text-[10px] text-slate-500">Remaining</p>
                          <p className="text-xs font-bold text-amber-500">{formatCurrency(remaining)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Sold by {debt.order.staff?.fullName || "Staff"}
                        </p>
                        <div className="space-y-1">
                          {saleLines(debt.order).map((line) => (
                            <div key={line.key} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate">
                                <Package size={11} className="text-slate-500 shrink-0" />
                                {line.name} {line.qtyLabel}
                              </span>
                              <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                {formatCurrency(line.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {debt.payments.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Payment History
                          </p>
                          <div className="space-y-1">
                            {debt.payments.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">
                                  {new Date(p.createdAt).toLocaleString()} — {p.staff?.fullName || "Staff"}
                                </span>
                                <span className="font-semibold text-emerald-500 shrink-0">{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => openPayModal(debt)}
                        className="w-full bg-amber-600 hover:bg-amber-500 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                      >
                        Log a Payment
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log payment sheet */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPayingDebt(null)} />
          <div className="relative w-full bg-[var(--bg-surface)] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Log Payment</h2>
              <button onClick={() => setPayingDebt(null)} className="p-2 text-slate-500 hover:text-[var(--text-primary)] transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{payingDebt.customer.name}</p>
            <p className="text-xs text-slate-500 mb-4">
              {formatCurrency(payingDebt.totalAmount - payingDebt.amountPaid)} remaining
            </p>

            <input
              type="number"
              min={0}
              max={payingDebt.totalAmount - payingDebt.amountPaid}
              placeholder="Amount received now (currencyCode)"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors mb-4"
            />

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setPayMethod("cash")}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  payMethod === "cash" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                }`}
              >
                💵 Cash
              </button>
              <button
                onClick={() => setPayMethod("transfer")}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  payMethod === "transfer" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                }`}
              >
                🏦 Transfer
              </button>
            </div>

            <button
              disabled={loading}
              onClick={handleLogPayment}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-60 py-4 rounded-2xl font-bold text-white transition-colors"
            >
              {loading ? "Saving..." : "Confirm Payment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}