"use client";
// FILE: apps/frontend/app/owner/invoices/summary/page.tsx (NEW FILE)
//
// Toggleable Daily / Monthly sales summary for the owner — aggregates
// every order (standard + scale items, both already merged by
// /api/invoices) into one totals + itemized-breakdown sheet that prints
// the same way the per-order invoice at /owner/invoices does.

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Receipt, Printer, ChevronLeft, ChevronRight, CalendarDays, CalendarRange } from "lucide-react";
import Link from "next/link";

interface OrderItemType {
  id: number;
  orderId: number;
  inventoryId: number;
  quantity: number;
  priceAtTime: any;
  inventory: { name: string } | null;
}

interface OrderType {
  id: number;
  total: any;
  date: string;
  ownerId: number;
  staffId: number | null;
  paymentMethod: string;
  staff: { fullName: string | null } | null;
  owner: {
    storeName: string | null;
    fullName: string | null;
    email: string;
  };
  items: OrderItemType[];
}

type Period = "day" | "month";

export default function SalesSummaryPage() {
  const [allOrders, setAllOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState("Store Owner");

  const [period, setPeriod] = useState<Period>("day");
  const [anchorDate, setAnchorDate] = useState(new Date());

  useEffect(() => {
    async function fetchInvoiceHistory() {
      try {
        const res = await fetch("/api/invoices");
        if (res.ok) {
          const payload = await res.json();
          setAllOrders(payload.orders || []);
          if (payload.merchantName) setMerchantName(payload.merchantName);
        }
      } catch (err) {
        console.error("Failed to load sales summary records:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoiceHistory();
  }, []);

  const shiftPeriod = (dir: 1 | -1) => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (period === "day") next.setDate(next.getDate() + dir);
      else next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isSameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const d = new Date(o.date);
      return period === "day" ? isSameDay(d, anchorDate) : isSameMonth(d, anchorDate);
    });
  }, [allOrders, anchorDate, period]);

  const summary = useMemo(() => {
    let totalSales = 0;
    let cashTotal = 0;
    let transferTotal = 0;
    const byStaff = new Map<string, { count: number; total: number }>();
    const byProduct = new Map<string, { qty: number; subtotal: number }>();

    for (const order of filteredOrders) {
      const total = Number(order.total);
      totalSales += total;
      if (order.paymentMethod?.toLowerCase() === "cash") cashTotal += total;
      else if (order.paymentMethod?.toLowerCase() === "transfer") transferTotal += total;

      const staffName = order.staff?.fullName || "Owner";
      const staffEntry = byStaff.get(staffName) || { count: 0, total: 0 };
      staffEntry.count += 1;
      staffEntry.total += total;
      byStaff.set(staffName, staffEntry);

      for (const item of order.items) {
        const name = item.inventory?.name || "Deleted Product";
        const subtotal = Number(item.priceAtTime) * item.quantity;
        const entry = byProduct.get(name) || { qty: 0, subtotal: 0 };
        entry.qty += item.quantity;
        entry.subtotal += subtotal;
        byProduct.set(name, entry);
      }
    }

    return {
      totalSales,
      cashTotal,
      transferTotal,
      orderCount: filteredOrders.length,
      byStaff: Array.from(byStaff.entries()).sort((a, b) => b[1].total - a[1].total),
      byProduct: Array.from(byProduct.entries()).sort((a, b) => b[1].subtotal - a[1].subtotal),
    };
  }, [filteredOrders]);

  const periodLabel =
    period === "day"
      ? anchorDate.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : anchorDate.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const storeName = allOrders[0]?.owner?.storeName || "Garrison Market";
  const ownerFullName = allOrders[0]?.owner?.fullName || merchantName;
  const ownerEmail = allOrders[0]?.owner?.email || "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-slate-600 dark:text-slate-400 text-sm">
        Loading sales summary...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8 print:p-0">
      <div className="max-w-4xl mx-auto space-y-4 print:block">
        {/* Controls — hidden on print */}
        <div className="print:hidden space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/owner/invoices" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] w-fit transition-colors text-sm">
              <ArrowLeft size={16} /> Invoice History
            </Link>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 border border-slate-300/60 dark:border-slate-700/60 text-xs text-[var(--text-primary)] font-semibold transition-all"
            >
              <Printer size={13} /> Print / Export PDF
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Receipt size={22} className="text-blue-500" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Sales Summary</h1>
          </div>

          {/* Daily / Monthly toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <button
                onClick={() => setPeriod("day")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                  period === "day" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-800 hover:dark:text-slate-200"
                }`}
              >
                <CalendarDays size={13} /> Daily
              </button>
              <button
                onClick={() => setPeriod("month")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors ${
                  period === "month" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-800 hover:dark:text-slate-200"
                }`}
              >
                <CalendarRange size={13} /> Monthly
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftPeriod(-1)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 hover:dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-semibold text-[var(--text-primary)] min-w-[9rem] text-center">{periodLabel}</span>
              <button
                onClick={() => shiftPeriod(1)}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 hover:dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setAnchorDate(new Date())}
                className="text-[11px] font-semibold text-blue-500 hover:text-blue-400 ml-1"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Print-ready sheet */}
        <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl print:border-none print:bg-transparent print:p-0 text-slate-700 dark:text-slate-300">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">{storeName}</h2>
              <p className="text-xs text-slate-500 mt-1">{period === "day" ? "Daily Sales Summary" : "Monthly Sales Summary"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 font-medium">{ownerFullName}</p>
              <p className="text-[11px] text-slate-500">{ownerEmail}</p>
            </div>
            <div className="sm:text-right">
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-3">
                {period === "day" ? "Daily Statement" : "Monthly Statement"}
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{periodLabel}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.orderCount} transaction{summary.orderCount !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Totals strip */}
          <div className="py-4 bg-slate-50/40 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl px-4 mt-6 grid grid-cols-3 gap-4 print:bg-transparent print:border-slate-700 print:dark:border-slate-300">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">₦{summary.cashTotal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transfer</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">₦{summary.transferTotal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Sales</p>
              <p className="text-sm font-bold text-blue-400 print:text-black mt-0.5">₦{summary.totalSales.toLocaleString()}</p>
            </div>
          </div>

          {/* Sales by staff */}
          {summary.byStaff.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Sales by Staff</h3>
              <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/20 print:border-slate-700 print:dark:border-slate-300">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 print:border-slate-700 print:dark:border-slate-300">
                      <th className="p-3 font-semibold">Staff</th>
                      <th className="p-3 font-semibold text-center w-24">Orders</th>
                      <th className="p-3 font-semibold text-right w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 print:divide-slate-300">
                    {summary.byStaff.map(([name, s]) => (
                      <tr key={name}>
                        <td className="p-3 font-medium text-[var(--text-primary)]">{name}</td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-400">{s.count}</td>
                        <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">₦{s.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itemized product breakdown */}
          <div className="mt-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Itemized Products Breakdown</h3>
            <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/20 print:border-slate-700 print:dark:border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 print:border-slate-700 print:dark:border-slate-300">
                    <th className="p-3 font-semibold">Product Name</th>
                    <th className="p-3 font-semibold text-center w-20">Qty</th>
                    <th className="p-3 font-semibold text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 print:divide-slate-300">
                  {summary.byProduct.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500">
                        No sales recorded for this {period === "day" ? "day" : "month"}.
                      </td>
                    </tr>
                  ) : (
                    summary.byProduct.map(([name, p]) => (
                      <tr key={name} className="hover:bg-slate-100/10 hover:dark:bg-slate-900/10 transition-colors">
                        <td className="p-3 font-medium text-[var(--text-primary)]">{name}</td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-400">{p.qty}</td>
                        <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">₦{p.subtotal.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals panel */}
          <div className="mt-6 flex justify-end">
            <div className="w-full sm:w-72 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 print:border-slate-700 print:dark:border-slate-300">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Transactions</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{summary.orderCount}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-800 border-dashed items-center print:border-slate-700 print:dark:border-slate-300">
                <span className="font-bold text-[var(--text-primary)]">Total {period === "day" ? "Daily" : "Monthly"} Sales</span>
                <span className="text-base font-black text-blue-400 print:text-black">₦{summary.totalSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-[10px] text-slate-500 space-y-1 print:border-slate-700 print:dark:border-slate-300">
            <p className="font-medium">Thank you for transacting with {storeName}!</p>
            <p>System-generated official accounting records. Certificate credentials verified.</p>
          </div>
        </div>
      </div>
    </div>
  );
}