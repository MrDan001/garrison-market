"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, History, ChevronDown, ChevronUp, Receipt, User, Calendar, List, Scale as ScaleIcon } from "lucide-react";
import Link from "next/link";

// An order can carry BOTH standard Inventory lines (order.items) and
// consignment-signed-out scale lines (order.scaleItems) on the same row —
// a merged-cart sale. Everywhere below treats them as one combined line
// list rather than assuming only `items` exists.
function combinedLines(order: any) {
  const list = (order.items || []).map((i: any) => ({
    kind: "list" as const,
    key: `list-${i.id}`,
    name: i.inventory?.name || "Unknown item",
    qtyLabel: `× ${i.quantity}`,
    qtyForCount: i.quantity,
    total: Number(i.priceAtTime) * i.quantity,
  }));
  const scale = (order.scaleItems || []).map((i: any) => ({
    kind: "scale" as const,
    key: `scale-${i.id}`,
    name: i.scaleInventory?.name || "Unknown item",
    qtyLabel: `${Number(i.quantity)}${i.unit}`,
    qtyForCount: 1,
    total: Number(i.priceAtTime),
  }));
  return [...list, ...scale];
}

export default function OrderHistoryClient({ orders }: { orders: any[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [tab, setTab] = useState<"day" | "customer">("day");

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

  // Groups every order that shares a phone number under one customer,
  // regardless of date — a staff member preparing/measuring materials for
  // someone needs everything that person has bought, not just today's.
  // Orders with no phone on file (mostly "Walk-in Customer") each stay as
  // their own standalone card, since there's no reliable way to tell two
  // nameless walk-ins apart.
  const customerGroups = useMemo(() => {
    const withPhone = new Map<string, { name: string; phone: string; orders: any[] }>();
    const withoutPhone: any[] = [];

    for (const order of orders) {
      const phone = order.buyerPhone?.trim();
      if (phone) {
        const existing = withPhone.get(phone);
        if (existing) {
          existing.orders.push(order);
          // Keep the most recent name on file for this phone number.
          if (new Date(order.date) > new Date(existing.orders[0].date)) existing.name = order.buyerName || existing.name;
        } else {
          withPhone.set(phone, { name: order.buyerName || "Customer", phone, orders: [order] });
        }
      } else {
        withoutPhone.push(order);
      }
    }

    const grouped = Array.from(withPhone.values()).map((g) => ({
      key: g.phone,
      name: g.name,
      phone: g.phone,
      orders: g.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));

    const solo = withoutPhone.map((o) => ({
      key: `order-${o.id}`,
      name: o.buyerName || "Walk-in Customer",
      phone: null as string | null,
      orders: [o],
    }));

    return [...grouped, ...solo].sort(
      (a, b) => new Date(b.orders[0].date).getTime() - new Date(a.orders[0].date).getTime()
    );
  }, [orders]);

  const grouped = groupByDay(orders);
  const dayKeys = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/staff/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-6 lg:mb-8 w-fit">
          <ArrowLeft size={20} /> Back
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-[var(--text-primary)] flex items-center gap-3">
          <History className="text-indigo-500" /> Order History
        </h1>

        <div className="flex gap-2 mb-6 lg:mb-8">
          <button
            onClick={() => setTab("day")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === "day" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Calendar size={13} /> By Day
          </button>
          <button
            onClick={() => setTab("customer")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              tab === "customer" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}
          >
            <User size={13} /> By Customer
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Receipt className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={32} />
            No sales recorded yet.
          </div>
        ) : tab === "day" ? (
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
                      const lines = combinedLines(order);
                      const itemCount = lines.reduce((sum, l) => sum + l.qtyForCount, 0);
                      const hasList = (order.items || []).length > 0;
                      const hasScale = (order.scaleItems || []).length > 0;

                      return (
                        <div
                          key={order.id}
                          className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 active:scale-[0.99] transition-all text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-[var(--text-primary)]">
                                  ₦{Number(order.total).toLocaleString()}
                                </p>
                                {hasList && hasScale && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-500">
                                    List + Scale
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {order.buyerName || "Walk-in Customer"} · {itemCount} item{itemCount !== 1 ? "s" : ""} ·{" "}
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
                            <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-[var(--bg-app)] space-y-2">
                              {lines.map((line) => (
                                <div key={line.key} className="flex justify-between text-sm gap-2">
                                  <span className="text-slate-700 dark:text-slate-300 truncate pr-2 flex items-center gap-1.5">
                                    {line.kind === "scale" ? (
                                      <ScaleIcon size={11} className="text-slate-400 shrink-0" />
                                    ) : (
                                      <List size={11} className="text-slate-400 shrink-0" />
                                    )}
                                    {line.name} {line.qtyLabel}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400 shrink-0">
                                    ₦{line.total.toLocaleString()}
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
        ) : (
          // --- By Customer: everything one buyer has bought, list + scale,
          // combined across every order they're on record for, so a staff
          // member can pull it up once and measure/prepare it all together.
          <div className="space-y-2">
            {customerGroups.map((group) => {
              const isExpanded = expandedCustomer === group.key;
              const groupTotal = group.orders.reduce((sum: number, o: any) => sum + Number(o.total), 0);

              // Merge quantities per product across every order in this
              // customer's group — list and scale kept separate since
              // their units differ.
              const listTally = new Map<string, { qty: number; total: number }>();
              const scaleTally = new Map<string, { qty: number; unit: string; total: number }>();
              for (const order of group.orders) {
                for (const i of order.items || []) {
                  const name = i.inventory?.name || "Unknown item";
                  const existing = listTally.get(name);
                  const total = Number(i.priceAtTime) * i.quantity;
                  if (existing) {
                    existing.qty += i.quantity;
                    existing.total += total;
                  } else {
                    listTally.set(name, { qty: i.quantity, total });
                  }
                }
                for (const i of order.scaleItems || []) {
                  const name = i.scaleInventory?.name || "Unknown item";
                  const existing = scaleTally.get(name);
                  const total = Number(i.priceAtTime);
                  if (existing) {
                    existing.qty += Number(i.quantity);
                    existing.total += total;
                  } else {
                    scaleTally.set(name, { qty: Number(i.quantity), unit: i.unit, total });
                  }
                }
              }
              const hasList = listTally.size > 0;
              const hasScale = scaleTally.size > 0;

              return (
                <div
                  key={group.key}
                  className="bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : group.key)}
                    className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[var(--text-primary)] truncate">{group.name}</p>
                          {hasList && hasScale && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-500">
                              List + Scale
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {group.phone ? `${group.phone} · ` : ""}
                          {group.orders.length} order{group.orders.length !== 1 ? "s" : ""} · ₦{groupTotal.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-500 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-[var(--bg-app)] space-y-4">
                      {hasList && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <List size={11} /> Standard items
                          </p>
                          <div className="space-y-1.5">
                            {Array.from(listTally.entries()).map(([name, v]) => (
                              <div key={name} className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{name} × {v.qty}</span>
                                <span className="text-slate-600 dark:text-slate-400 shrink-0">₦{v.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasScale && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ScaleIcon size={11} /> Scale items — to measure
                          </p>
                          <div className="space-y-1.5">
                            {Array.from(scaleTally.entries()).map(([name, v]) => (
                              <div key={name} className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{name} — {v.qty}{v.unit}</span>
                                <span className="text-slate-600 dark:text-slate-400 shrink-0">₦{v.total.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Order dates</p>
                        <div className="space-y-1">
                          {group.orders.map((o: any) => (
                            <div key={o.id} className="flex justify-between text-xs text-slate-500">
                              <span>{new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>₦{Number(o.total).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}