"use client";

import { useState, useEffect } from "react";
import { Printer, Receipt } from "lucide-react";

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
  const [merchantName, setMerchantName] = useState("Store Owner");

  useEffect(() => {
    async function fetchTodaysInvoices() {
      try {
        const res = await fetch("/api/invoices");
        if (res.ok) {
          const payload = await res.json();
          const rawOrders: OrderType[] = payload.orders || [];

          // 🌟 Filter client-side to ONLY retain current calendar day records
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const filtered = rawOrders.filter((order) => {
            const orderDate = new Date(order.date);
            return orderDate >= startOfToday;
          });

          setTodaysOrders(filtered);
          if (payload.merchantName) setMerchantName(payload.merchantName);
        }
      } catch (err) {
        console.error("Failed to query staff daily records:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTodaysInvoices();
  }, []);

  // Grabs the most recent ticket created today to display on the workspace canvas
  const activeOrder = todaysOrders.length > 0 ? todaysOrders[todaysOrders.length - 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center text-slate-400 text-sm">
        Loading today's register transactions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 p-4 sm:p-8 print:p-0">
      <div className="max-w-3xl mx-auto">
        {activeOrder ? (
          <div className="space-y-4">
            {/* Action Bar (Hidden on Print Mode) */}
            <div className="flex justify-between items-center bg-slate-900/30 border border-slate-800/60 p-3 rounded-xl print:hidden">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift Daily Log ({todaysOrders.length} settled today)
              </span>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs text-white font-semibold transition-all"
              >
                <Printer size={13} /> Print / Export PDF
              </button>
            </div>

            {/* Print-Ready Sheet Canvas */}
            <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl print:border-none print:bg-transparent print:p-0 text-slate-300">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-800/80">
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase">
                    {activeOrder.owner?.storeName || "Garrison Market"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Daily Register Receipt</p>
                  <p className="text-xs text-slate-400 mt-3 font-medium">{activeOrder.owner?.fullName}</p>
                  <p className="text-[11px] text-slate-500">{activeOrder.owner?.email}</p>
                </div>
                <div className="sm:text-right">
                  <div className="inline-block px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider mb-3">
                    Terminal Confirmed
                  </div>
                  <p className="text-sm font-bold text-white">INVOICE NO: #{activeOrder.id}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Date: {new Date(activeOrder.date).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="py-4 bg-slate-950/40 border border-slate-800/40 rounded-xl px-4 mt-6 grid grid-cols-2 gap-4 print:bg-transparent print:border-slate-300">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Authorized Merchant</p>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">{merchantName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sales Register Clerk</p>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">
                    {activeOrder.staff?.fullName || "Owner Account"}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Itemized Products Breakdown</h3>
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/20 print:border-slate-300">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 print:border-slate-300">
                        <th className="p-3 font-semibold">Product Name</th>
                        <th className="p-3 font-semibold text-center w-16">Qty</th>
                        <th className="p-3 font-semibold text-right w-28">Unit Price</th>
                        <th className="p-3 font-semibold text-right w-32">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 print:divide-slate-300">
                      {activeOrder.items.map((item: OrderItemType) => {
                        const subValue = Number(item.priceAtTime) * item.quantity;
                        return (
                          <tr key={item.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-3 font-medium text-white">{item.inventory?.name || "Deleted Product"}</td>
                            <td className="p-3 text-center text-slate-400">{item.quantity}</td>
                            <td className="p-3 text-right text-slate-400">₦{Number(item.priceAtTime).toLocaleString()}</td>
                            <td className="p-3 text-right font-semibold text-slate-200">₦{subValue.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Panel */}
              <div className="mt-6 flex justify-end">
                <div className="w-full sm:w-72 space-y-2 border-t border-slate-800/80 pt-4 print:border-slate-300">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Gross Subtotal</span>
                    <span className="font-medium text-slate-300">₦{Number(activeOrder.total).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-800 border-dashed items-center print:border-slate-300">
                    <span className="font-bold text-white">Amount Settled</span>
                    <span className="text-base font-black text-blue-400 print:text-black">
                      ₦{Number(activeOrder.total).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Declaration Footer */}
              <div className="mt-12 pt-6 border-t border-slate-800/60 text-center text-[10px] text-slate-500 space-y-1 print:border-slate-300">
                <p className="font-medium">Thank you for transacting with {activeOrder.owner?.storeName || "us"}!</p>
                <p>Shift Session Records. Resetting dynamically at midnight terminal close.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-16 text-center border border-slate-800 rounded-2xl bg-slate-900/10 max-w-xl mx-auto mt-12">
            <Receipt size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm font-semibold">No transactions registered today.</p>
            <p className="text-slate-600 text-xs mt-1">Previous statements have cleared for your shift security.</p>
          </div>
        )}
      </div>
    </div>
  );
}