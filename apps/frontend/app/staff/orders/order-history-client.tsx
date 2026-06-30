"use client";

import { useState } from "react";
import { ArrowLeft, History, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import Link from "next/link";

export default function OrderHistoryClient({ orders }: { orders: any[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const groupByDay = (orders: any[]) => {
    const groups: { [key: string]: any[] } = {};
    orders.forEach((order) => {
      const dateKey = new Date(order.date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(order);
    });
    return groups;
  };

  const grouped = groupByDay(orders);
  const dayKeys = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/staff/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 lg:mb-8 w-fit">
          <ArrowLeft size={20} /> Back
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 lg:mb-8 text-white flex items-center gap-3">
          <History className="text-indigo-500" /> Order History
        </h1>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            <Receipt className="mx-auto mb-3 text-slate-700" size={32} />
            No sales recorded yet.
          </div>
        ) : (
          <div className="space-y-8">
            {dayKeys.map((day) => {
              const dayOrders = grouped[day];
              const dayTotal = dayOrders.reduce((sum, o) => sum + Number(o.total), 0);

              return (
                <div key={day}>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{day}</h2>
                    <span className="text-sm font-bold text-emerald-400">
                      ₦{dayTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayOrders.map((order) => {
                      const isExpanded = expandedId === order.id;
                      const itemCount = order.items.reduce((sum: number, i: any) => sum + i.quantity, 0);

                      return (
                        <div
                          key={order.id}
                          className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-800/30 active:scale-[0.99] transition-all text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-white">
                                ₦{Number(order.total).toLocaleString()}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {itemCount} item{itemCount !== 1 ? "s" : ""} ·{" "}
                                {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp size={18} className="text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown size={18} className="text-slate-500 shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-800 p-4 bg-[#0a0c10] space-y-2">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-slate-300 truncate pr-2">
                                    {item.inventory?.name || "Unknown item"} × {item.quantity}
                                  </span>
                                  <span className="text-slate-400 shrink-0">
                                    ₦{(Number(item.priceAtTime) * item.quantity).toLocaleString()}
                                  </span>
                                </div>
                              ))}
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