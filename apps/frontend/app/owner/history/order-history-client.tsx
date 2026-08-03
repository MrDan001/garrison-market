"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, History, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import Link from "next/link";

export default function OwnerOrderHistoryClient({ orders = [] }: { orders: any[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Group orders by day and calculate daily metrics (Sales & Net Profit)
  const groupedData = useMemo(() => {
    const groups: { [key: string]: { orders: any[]; totalSales: number; totalProfit: number } } = {};

    orders.forEach((order) => {
      if (!order || !order.date) return; // Safeguard against null records

      const dateKey = new Date(order.date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });

      // Standard (Inventory) line profit — priceAtTime is PER UNIT here.
      const standardProfit = (order.items || []).reduce((sum: number, item: any) => {
        const costPrice = item.costPriceAtTime ?? item.inventory?.costPrice ?? 0;
        const profitPerItem = Number(item.priceAtTime) - Number(costPrice);
        return sum + (profitPerItem * item.quantity);
      }, 0);

      // Scale line profit — priceAtTime here is already the TOTAL line
      // price (not per-unit), and there's no costPriceAtTime captured at
      // sale time for scale lines, so cost falls back to the scale item's
      // current costPrice, same fallback pattern as the standard side.
      const scaleProfit = (order.scaleItems || []).reduce((sum: number, item: any) => {
        const costPrice = Number(item.scaleInventory?.costPrice ?? 0);
        const qty = Number(item.quantityInBaseUnit ?? item.quantity ?? 0);
        return sum + (Number(item.priceAtTime) - costPrice * qty);
      }, 0);

      const orderProfit = standardProfit + scaleProfit;

      if (!groups[dateKey]) {
        groups[dateKey] = { orders: [], totalSales: 0, totalProfit: 0 };
      }

      groups[dateKey].orders.push({ ...order, profit: orderProfit });
      groups[dateKey].totalSales += Number(order.total || 0);
      groups[dateKey].totalProfit += orderProfit;
    });

    return groups;
  }, [orders]);

  const dayKeys = Object.keys(groupedData);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit text-sm font-semibold">
          <ArrowLeft size={18} /> Back Dashboard
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 lg:mb-8 text-[var(--text-primary)] flex items-center gap-3">
          <History className="text-blue-500" /> Management Order History
        </h1>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-[var(--bg-surface)]/30">
            <Receipt className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
            No business sales recorded yet.
          </div>
        ) : (
          <div className="space-y-8">
            {dayKeys.map((day) => {
              const { orders: dayOrders, totalSales, totalProfit } = groupedData[day];

              return (
                <div key={day}>
                  {/* Daily Section Heading Summary Block */}
                  <div className="flex items-end justify-between mb-3 px-1 border-b border-slate-200/40 dark:border-slate-800/40 pb-2">
                    <div>
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</h2>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <span className="text-[10px] block uppercase text-slate-500 font-bold tracking-tight">Sales</span>
                        <span className="text-sm font-bold text-blue-400">₦{totalSales.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block uppercase text-slate-500 font-bold tracking-tight">Net Profit</span>
                        <span className={`text-sm font-bold ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          ₦{totalProfit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Day Orders */}
                  <div className="space-y-2.5">
                    {dayOrders.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const standardCount = (order.items || []).reduce((sum: number, i: any) => sum + i.quantity, 0);
                      const scaleCount = (order.scaleItems || []).length;
                      const itemCount = standardCount + scaleCount;

                      return (
                        <div
                          key={order.id}
                          className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all hover:border-slate-300 hover:dark:border-slate-700"
                        >
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-200/20 hover:dark:bg-slate-800/20 transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1 flex items-center justify-between pr-2">
                              <div>
                                <p className="font-bold text-[var(--text-primary)] text-base">
                                  ₦{Number(order.total || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {itemCount} item{itemCount !== 1 ? "s" : ""} ·{" "}
                                  {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="text-right mr-2">
                                <span className="text-[9px] block text-slate-500 uppercase font-semibold">Margin</span>
                                <span className={`text-xs font-semibold ${order.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {order.profit >= 0 ? "+" : ""}₦{order.profit.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-slate-600 dark:text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-600 dark:text-slate-400 shrink-0" />
                            )}
                          </button>

                          {/* Expanded item breakdown drawer */}
                          {isExpanded && (
                            <div className="border-t border-slate-200/60 dark:border-slate-800/60 p-4 bg-[var(--bg-app)]/60 space-y-2.5">
                              {(order.items || []).map((item: any, idx: number) => {
                                const currentCost = item.costPriceAtTime ?? item.inventory?.costPrice ?? 0;
                                const currentMargin = Number(item.priceAtTime) - Number(currentCost);

                                return (
                                  <div key={`std-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-b border-slate-100 dark:border-slate-900 pb-2 last:border-0 last:pb-0">
                                    <div className="min-w-0">
                                      <span className="font-medium text-slate-700 dark:text-slate-300 block truncate">
                                        {item.inventory?.name || "Deleted Item"}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        Qty: {item.quantity} × ₦{Number(item.priceAtTime).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-[11px] font-semibold shrink-0">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        Total: ₦{(Number(item.priceAtTime) * item.quantity).toLocaleString()}
                                      </span>
                                      <span className={currentMargin >= 0 ? "text-emerald-500/90 text-[10px]" : "text-rose-500/90 text-[10px]"}>
                                        Profit: {currentMargin >= 0 ? "+" : ""}₦{(currentMargin * item.quantity).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              {(order.scaleItems || []).map((item: any, idx: number) => {
                                const costPrice = Number(item.scaleInventory?.costPrice ?? 0);
                                const qty = Number(item.quantityInBaseUnit ?? item.quantity ?? 0);
                                const lineMargin = Number(item.priceAtTime) - costPrice * qty;

                                return (
                                  <div key={`scale-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-b border-slate-100 dark:border-slate-900 pb-2 last:border-0 last:pb-0">
                                    <div className="min-w-0">
                                      <span className="font-medium text-slate-700 dark:text-slate-300 block truncate">
                                        {item.scaleInventory?.name || "Deleted Item"}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {Number(item.quantity)}{item.unit}
                                      </span>
                                    </div>
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-[11px] font-semibold shrink-0">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        Total: ₦{Number(item.priceAtTime).toLocaleString()}
                                      </span>
                                      <span className={lineMargin >= 0 ? "text-emerald-500/90 text-[10px]" : "text-rose-500/90 text-[10px]"}>
                                        Profit: {lineMargin >= 0 ? "+" : ""}₦{lineMargin.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}