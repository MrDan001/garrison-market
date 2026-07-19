"use client";

import { useState, useEffect } from "react";
import { Printer, Receipt, AlertTriangle, User, Phone } from "lucide-react";

interface OrderItemType {
  id: number;
  orderId: number;
  inventoryId: number;
  quantity: number;
  priceAtTime: any;
  inventory: {
    name: string;
  };
}

interface OrderType {
  id: number;
  total: any;
  date: string;
  ownerId: number;
  staffId: number | null;
  buyerName: string | null;
  buyerPhone: string | null;
  staff: {
    fullName: string | null;
  } | null;
  owner: {
    storeName: string | null;
    fullName: string | null;
    email: string;
  };
  items: OrderItemType[];
}

export default function StaffInvoicesPage() {
  const [todaysOrders, setTodaysOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("Store Owner");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTodaysInvoices() {
      try {
        const res = await fetch("/api/invoices");

        if (!res.ok) {
          setError(`Couldn't load today's sales (server returned ${res.status}).`);
          return;
        }

        const payload = await res.json();
        const rawOrders: OrderType[] = payload.orders || [];

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        const filtered = rawOrders.filter((order) => {
          const orderDate = new Date(order.date);
          return orderDate >= startOfToday && orderDate < startOfTomorrow;
        });

        // Most recent first — the sale a customer is asking about right now
        // is usually the one that just happened.
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTodaysOrders(filtered);
        setSelectedOrderId(filtered[0]?.id ?? null);
        if (payload.merchantName) setMerchantName(payload.merchantName);
      } catch (err) {
        console.error("Failed to query staff daily records:", err);
        setError("Something went wrong loading today's sales. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchTodaysInvoices();
  }, []);

  const selectedOrder =
    todaysOrders.find((o) => o.id === selectedOrderId) || todaysOrders[0] || null;
  const dayTotal = todaysOrders.reduce((sum, o) => sum + Number(o.total), 0);

  // Helper utility to safely extract the buyer's first name
  const getBuyerFirstName = (fullName: string | null) => {
    if (!fullName || !fullName.trim()) return "Walk-in";
    const cleaned = fullName.trim();
    if (cleaned.toLowerCase() === "walk-in customer") return "Walk-in";
    return cleaned.split(" ")[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-slate-600 dark:text-slate-400 text-sm">
        Loading today's register transactions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center px-4">
        <div className="max-w-md text-center border border-red-900/40 bg-red-950/20 rounded-2xl p-8">
          <AlertTriangle size={28} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-300 text-sm font-semibold">{error}</p>
          <p className="text-slate-500 text-xs mt-2">
            This is a load failure, not an empty day — retry, or flag it to the owner.
          </p>
        </div>
      </div>
    );
  }

  // Dual page wrapper definitions for printing
  const invoiceCopies = ["ATTENDANT COPY", "CUSTOMER'S COPY"];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8 print:p-0">
      <div className="max-w-3xl mx-auto">
        {selectedOrder ? (
          <div className="space-y-4">
            {/* Shift summary + order picker — hidden on print */}
            <div className="space-y-3 print:hidden">
              <div className="flex justify-between items-center bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-xl">
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {todaysOrders.length} sale{todaysOrders.length !== 1 ? "s" : ""} today &middot; ₦
                  {dayTotal.toLocaleString()} total
                </span>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 border border-slate-300/60 dark:border-slate-700/60 text-xs text-[var(--text-primary)] font-semibold transition-all"
                >
                  <Printer size={13} /> Print This Invoice
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {todaysOrders.map((order) => {
                  const isActive = order.id === selectedOrder.id;
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`flex-shrink-0 text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                        isActive
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
                          : "bg-slate-100/30 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:dark:border-slate-700"
                      }`}
                    >
                      {/* FIXED: Button label matches Order #number BuyerFirstName format */}
                      <div className="font-semibold">
                        Order #{order.id} {getBuyerFirstName(order.buyerName)}
                      </div>
                      <div className="text-[10px] opacity-80">
                        {new Date(order.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &middot; ₦{Number(order.total).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-600 px-1">
                Pick the order the customer is asking about, then print just that invoice.
              </p>
            </div>

            {/* Print-Ready Duplicated Invoices Wrapper */}
            <div className="space-y-8 print:space-y-0">
              {invoiceCopies.map((copyTitle, copyIndex) => (
                <div
                  key={copyTitle}
                  className={`p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl print:border-none print:bg-transparent print:p-0 text-slate-300 ${
                    copyIndex > 0 ? "print:break-before-page print:mt-12 print:pt-12 print:border-t-2 print:border-dashed print:border-slate-600 print:dark:border-slate-400" : ""
                  }`}
                >
                  {/* Distinct Copy Header Badge */}
                  <div className="mb-4 text-center font-black text-xs tracking-widest text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800/80 py-1 rounded-lg bg-slate-50/20 dark:bg-slate-950/20 print:border-slate-600 print:dark:border-slate-400 print:text-black">
                    {copyTitle}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80 print:border-slate-700 print:dark:border-slate-300">
                    <div>
                      <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase print:text-black">
                        {selectedOrder.owner?.storeName || "Garrison Market"}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">Sales Invoice</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 font-medium print:text-black">{selectedOrder.owner?.fullName}</p>
                      <p className="text-[11px] text-slate-500">{selectedOrder.owner?.email}</p>
                    </div>
                    <div className="sm:text-right">
                      <div className="inline-block px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider mb-3 print:border-slate-600 print:dark:border-slate-400 print:text-black">
                        Terminal Confirmed
                      </div>
                      {/* FIXED: Title matches Invoice No: #number BuyerFirstName format */}
                      <p className="text-sm font-bold text-[var(--text-primary)] print:text-black">
                        INVOICE NO: #{selectedOrder.id} {getBuyerFirstName(selectedOrder.buyerName)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Date: {new Date(selectedOrder.date).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="py-4 bg-slate-50/40 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl px-4 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 print:bg-transparent print:border-slate-700 print:dark:border-slate-300 print:text-black">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shop Owner</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 print:text-black">
                        {selectedOrder.owner?.fullName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sold By</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 print:text-black">
                        {selectedOrder.staff?.fullName || "Staff Account"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <User size={10} /> Buyer
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 print:text-black">
                        {selectedOrder.buyerName?.trim() || "Walk-in Customer"}
                      </p>
                      {selectedOrder.buyerPhone && (
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1.5 print:text-black">
                          <Phone size={11} className="text-slate-500 print:text-black" /> {selectedOrder.buyerPhone.trim()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Itemized Products Breakdown
                    </h3>
                    <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/20 print:border-slate-700 print:dark:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 print:border-slate-700 print:dark:border-slate-300 print:text-black">
                            <th className="p-3 font-semibold">Product Name</th>
                            <th className="p-3 font-semibold text-center w-16">Qty</th>
                            <th className="p-3 font-semibold text-right w-28">Unit Price</th>
                            <th className="p-3 font-semibold text-right w-32">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 print:divide-slate-300 print:text-black">
                          {selectedOrder.items.map((item) => {
                            const subValue = Number(item.priceAtTime) * item.quantity;
                            return (
                              <tr key={item.id} className="hover:bg-slate-100/10 hover:dark:bg-slate-900/10 transition-colors">
                                <td className="p-3 font-medium text-[var(--text-primary)] print:text-black">
                                  {item.inventory?.name || "Deleted Product"}
                                </td>
                                <td className="p-3 text-center text-slate-600 dark:text-slate-400 print:text-black">{item.quantity}</td>
                                <td className="p-3 text-right text-slate-600 dark:text-slate-400 print:text-black">
                                  ₦{Number(item.priceAtTime).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                                  ₦{subValue.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="w-full sm:w-72 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 print:border-slate-700 print:dark:border-slate-300">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Gross Subtotal</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                          ₦{Number(selectedOrder.total).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-800 border-dashed items-center print:border-slate-700 print:dark:border-slate-300">
                        <span className="font-bold text-[var(--text-primary)] print:text-black">Amount Settled</span>
                        <span className="text-base font-black text-blue-400 print:text-black">
                          ₦{Number(selectedOrder.total).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signature slots block layout */}
                  <div className="mt-10 grid grid-cols-2 gap-8 max-w-md mx-auto pt-4 border-t border-slate-200/40 dark:border-slate-800/40 print:border-slate-700 print:dark:border-slate-300 print:text-black">
                    <div className="text-center">
                      <div className="border-b border-slate-200 dark:border-slate-800 h-8 w-full print:border-black" />
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1.5">Attendant Sign</p>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-slate-200 dark:border-slate-800 h-8 w-full print:border-black" />
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-1.5">Customer Sign</p>
                    </div>
                  </div>

                  <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-[10px] text-slate-500 space-y-1 print:border-slate-700 print:dark:border-slate-300">
                    <p className="font-medium">
                      Thank you for transacting with {selectedOrder.owner?.storeName || "us"}!
                    </p>
                    <p>Shift Session Records. Resetting dynamically at midnight terminal close.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-16 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/10 dark:bg-slate-900/10 max-w-xl mx-auto mt-12">
            <Receipt size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No transactions registered today.</p>
            <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Previous statements have cleared for your shift security.</p>
          </div>
        )}
      </div>
    </div>
  );
}