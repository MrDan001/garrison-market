"use client";
// FILE: apps/frontend/app/owner/customers/customers-client.tsx
//
// Two tabs: "Customers" (the existing spend ranking, with a small debt
// badge next to anyone who owes — visible no matter how they rank) and
// "Debts" (a dedicated list of every open debt, independent of the
// year/month filter — a debt doesn't stop mattering just because you
// switched to viewing last year's spend).

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Trophy, Phone, Receipt, HandCoins, ChevronDown, User, Package, Clock, Crown } from "lucide-react";
import { getCustomersForOwner } from "@/lib/customer.actions";
import { getOpenDebtsForOwner } from "@/lib/debt.actions";
import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";

type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
};

type CustomersData = {
  customers: CustomerRow[];
  years: number[];
  year: number;
  month: number | null;
};

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
  customerId: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  createdAt: string;
  customer: { id: number; name: string; phone: string };
  order: {
    id: number;
    date: string;
    items: DebtItem[];
    scaleItems: DebtScaleItem[];
    staff: { fullName: string | null } | null;
  };
  payments: DebtPaymentType[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];



// A debt's order can be a plain "list" sale, a scale sale, or a merged mix
// of both — items and scaleItems have to be flattened into one line format.
// List lines total = priceAtTime × quantity; scale lines store priceAtTime
// as the line's total already (matches order-history-client.tsx's
// convention for the same two relations).
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

function DebtCard({ debt }: { debt: DebtType }) {
  const { formatCurrency } = useBusinessCurrency();
  const remaining = debt.totalAmount - debt.amountPaid;
  const lines = saleLines(debt.order);

  return (
    <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{debt.customer.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Phone size={10} /> {debt.customer.phone}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Owed</p>
          <p className="text-base font-bold text-amber-500">{formatCurrency(remaining)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {new Date(debt.createdAt).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <User size={10} /> Sold by {debt.order.staff?.fullName || "Staff"}
        </span>
      </div>

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

      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-slate-500 uppercase tracking-wide text-[11px] flex items-center gap-1">
          <Package size={11} /> Items bought ({lines.length})
        </summary>
        <div className="mt-2 space-y-1 pl-4">
          {lines.length === 0 ? (
            <p className="text-slate-400">No line items on this order.</p>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {line.name} {line.qtyLabel}
                </span>
                <span className="text-slate-600 dark:text-slate-400 shrink-0">{formatCurrency(line.total)}</span>
              </div>
            ))
          )}
        </div>
      </details>

      {debt.payments.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment History</p>
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
    </div>
  );
}

export default function CustomersClient({
  initial,
  initialDebts,
}: {
  initial: CustomersData;
  initialDebts: DebtType[];
}) {
  const [data, setData] = useState<CustomersData>(initial);
  const [debts, setDebts] = useState<DebtType[]>(initialDebts);
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"customers" | "debts" | "year">("customers");

  // "Year Champion" tab — always the whole-year ranking (month forced to
  // null), kept in its own state so switching to it never disturbs whatever
  // month/year the Ranking tab has selected. Loaded lazily on first visit,
  // then re-fetched only when the year dropdown here changes.
  const [yearData, setYearData] = useState<CustomersData | null>(
    initial.month === null ? initial : null
  );
  const [yearRankYear, setYearRankYear] = useState<number>(initial.year);
  const [yearPending, startYearTransition] = useTransition();

  function refetch(year: number, month: number | null) {
    startTransition(async () => {
      const [customersResult, debtsResult] = await Promise.all([
        getCustomersForOwner({ year, month }),
        getOpenDebtsForOwner(),
      ]);
      setData(customersResult);
      setDebts(debtsResult as unknown as DebtType[]);
    });
  }

  function fetchYearRanking(year: number) {
    setYearRankYear(year);
    startYearTransition(async () => {
      const result = await getCustomersForOwner({ year, month: null });
      setYearData(result);
    });
  }

  function openYearTab() {
    setTab("year");
    if (!yearData) fetchYearRanking(yearRankYear);
  }

  const owedByCustomer = new Map<number, number>();
  for (const debt of debts) {
    owedByCustomer.set(debt.customerId, (owedByCustomer.get(debt.customerId) ?? 0) + (debt.totalAmount - debt.amountPaid));
  }
  const totalOutstanding = debts.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back Dashboard
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3 mb-5">
          <Users className="text-blue-500" /> Customers
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("customers")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === "customers" ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm" : "text-slate-500"
            }`}
          >
            Ranking
          </button>
          <button
            onClick={() => setTab("debts")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              tab === "debts" ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm" : "text-slate-500"
            }`}
          >
            Debts
            {debts.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                {debts.length}
              </span>
            )}
          </button>
          <button
            onClick={openYearTab}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              tab === "year" ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm" : "text-slate-500"
            }`}
          >
            <Crown size={14} className={tab === "year" ? "text-amber-400" : ""} /> Year Champion
          </button>
        </div>

        {tab === "customers" ? (
          <>

            <div className="flex items-center justify-end gap-2 mb-5">
              <select
                value={data.month ?? ""}
                onChange={(e) => {
                  const month = e.target.value ? parseInt(e.target.value, 10) : null;
                  refetch(data.year, month);
                }}
                className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">Whole Year</option>
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={data.year}
                onChange={(e) => refetch(parseInt(e.target.value, 10), data.month)}
                className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                {data.years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {data.customers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
                <Users className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
                No customers recorded yet {data.month ? `for ${MONTHS[data.month - 1]} ${data.year}` : `in ${data.year}`}.
                <p className="text-xs mt-2 text-slate-500/80 max-w-xs mx-auto">
                  Customers show up here once staff pick or type a name and phone number at checkout.
                </p>
              </div>
            ) : (
              <div className={`bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-opacity ${isPending ? "opacity-50" : ""}`}>
                <div className="hidden sm:grid grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  <span>#</span>
                  <span>Customer</span>
                  <span className="text-right">Orders</span>
                  <span className="text-right">Total Spent</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-900">
                  {data.customers.map((c, idx) => {
                    const owed = owedByCustomer.get(c.id);

                    return (
                      <div
                        key={c.id}
                        className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3.5 items-center"
                      >
                        <span className="flex items-center justify-center">
                          {idx === 0 ? (
                            <Trophy size={16} className="text-amber-400" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400 w-4 text-center">{idx + 1}</span>
                          )}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.name}</p>
                            {/* Always shown regardless of rank — a debt doesn't
                                get less visible just because this customer
                                also happens to be a top spender. */}
                            {owed != null && owed > 0 && (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                <HandCoins size={9} /> Owes {formatCurrency(owed)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {c.phone}
                          </p>
                        </div>

                        <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 justify-end">
                          <Receipt size={12} /> {c.orderCount}
                        </span>

                        <span className="text-sm font-bold text-emerald-500 text-right">
                          {formatCurrency(c.totalSpent)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : tab === "debts" ? (
          <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
            {debts.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-500 font-semibold uppercase tracking-wide">Total Outstanding</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(totalOutstanding)}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <HandCoins size={20} className="text-amber-500" />
                </div>
              </div>
            )}

            {debts.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
                <HandCoins size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No open debts</p>
                <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Every part payment has been settled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {debts.map((debt) => (
                  <DebtCard key={debt.id} debt={debt} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-end gap-2 mb-5">
              <select
                value={yearRankYear}
                onChange={(e) => fetchYearRanking(parseInt(e.target.value, 10))}
                className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                {data.years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className={`transition-opacity ${yearPending ? "opacity-50" : ""}`}>
              {!yearData || yearData.customers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
                  <Crown className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
                  No customers recorded yet in {yearRankYear}.
                </div>
              ) : (
                <>
                  {/* Champion spotlight — the single top spender for the
                      whole year, called out separately from the list below
                      so "who's #1 this year" is answerable at a glance. */}
                  {(() => {
                    const champion = yearData.customers[0];
                    const owed = owedByCustomer.get(champion.id);
                    return (
                      <div className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/30 rounded-2xl p-5 mb-5 flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                          <Crown size={26} className="text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
                            {yearRankYear} Customer of the Year
                          </p>
                          <p className="font-bold text-[var(--text-primary)] text-lg truncate">{champion.name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {champion.phone}
                            <span className="mx-1">·</span>
                            <Receipt size={10} /> {champion.orderCount} orders
                          </p>
                          {owed != null && owed > 0 && (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1.5">
                              <HandCoins size={9} /> Owes {formatCurrency(owed)}
                            </span>
                          )}
                        </div>
                        <p className="text-xl font-bold text-emerald-500 text-right shrink-0">
                          {formatCurrency(champion.totalSpent)}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      <span>#</span>
                      <span>Customer</span>
                      <span className="text-right">Orders</span>
                      <span className="text-right">Total Spent ({yearRankYear})</span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-900">
                      {yearData.customers.map((c, idx) => {
                        const owed = owedByCustomer.get(c.id);
                        return (
                          <div
                            key={c.id}
                            className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_auto_auto] gap-4 px-4 py-3.5 items-center"
                          >
                            <span className="flex items-center justify-center">
                              {idx === 0 ? (
                                <Trophy size={16} className="text-amber-400" />
                              ) : (
                                <span className="text-xs font-bold text-slate-400 w-4 text-center">{idx + 1}</span>
                              )}
                            </span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.name}</p>
                                {owed != null && owed > 0 && (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                    <HandCoins size={9} /> Owes {formatCurrency(owed)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {c.phone}
                              </p>
                            </div>

                            <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500 justify-end">
                              <Receipt size={12} /> {c.orderCount}
                            </span>

                            <span className="text-sm font-bold text-emerald-500 text-right">
                              {formatCurrency(c.totalSpent)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
