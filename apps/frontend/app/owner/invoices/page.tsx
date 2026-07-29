"use client"; 

import { useState, useEffect, use } from "react";
import { ArrowLeft, Receipt, Printer, Search, MessageCircle, BarChart3 } from "lucide-react";
import Link from "next/link";

interface InvoicesPageProps {
  searchParams: Promise<{ id?: string }>;
}

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
  calculatedTotal: any; // ← NEW: Calculated from merged items
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

export default function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const resolvedSearchParams = use(searchParams);
  const activeInvoiceId = resolvedSearchParams.id ? parseInt(resolvedSearchParams.id, 10) : null;

  const [allOrders, setAllOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState("Store Owner");
  
  // 🌟 Added search query state tracker
  const [searchQuery, setSearchQuery] = useState("");

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
        console.error("Failed to query merchant statement records:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoiceHistory();
  }, []);

  // 🌟 Filters past invoices by Reference ID number OR Staff Member Name
  const filteredOrders = allOrders.filter((order) => {
    const matchesId = `inv-#${order.id}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      order.id.toString().includes(searchQuery);
    const matchesStaff = order.staff?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const isOwnerSale = "owner".includes(searchQuery.toLowerCase()) && !order.staff;

    return matchesId || matchesStaff || isOwnerSale;
  });

  // Display the active selected invoice, or fall back to the first match in the filtered queue
  const selectedOrder = activeInvoiceId 
    ? allOrders.find((o: OrderType) => o.id === activeInvoiceId)
    : (filteredOrders.length > 0 ? filteredOrders[0] : null); 

  const sendInvoiceViaWhatsApp = (order: OrderType) => {
    const lines = [
      `*${order.owner?.storeName || "Garrison Market"}* — Sales Invoice`,
      `Invoice #${order.id} — ${new Date(order.date).toLocaleString()}`,
      "",
      ...order.items.map(
        (item) => `${item.inventory?.name || "Item"} x${item.quantity} — ₦${(Number(item.priceAtTime) * item.quantity).toLocaleString()}`
      ),
      "",
      `*Total: ₦${Number(order.calculatedTotal).toLocaleString()}*`,
      "",
      `Thank you for shopping with us!`,
    ];
    const message = encodeURIComponent(lines.join("\n"));
    const url = `https://wa.me/?text=${message}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-slate-600 dark:text-slate-400 text-sm">
        Loading merchant statement records...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8 print:p-0">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        
        {/* LEFT COLUMN: History Queue (Hidden on Print Mode) */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-4 w-fit transition-colors text-sm">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Receipt size={22} className="text-blue-500" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Invoice History</h1>
          </div>

          <Link
            href="/owner/invoices/summary"
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-500 hover:bg-blue-600/20 text-xs font-semibold transition-colors mb-2"
          >
            <BarChart3 size={13} /> Daily / Monthly Sales Summary
          </Link>

          {/* 🌟 Interactive Search Filter Input Box */}
          <div className="relative w-full mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search ID or Staff name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/20 dark:bg-slate-900/20">
                <Receipt size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">No matching invoices found.</p>
              </div>
            ) : (
              filteredOrders.map((order: OrderType) => {
                const isActive = selectedOrder?.id === order.id;
                return (
                  <Link
                    key={order.id}
                    href={`/owner/invoices?id=${order.id}`}
                    className={`block p-4 rounded-xl border transition-all ${
                      isActive 
                        ? "bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/5" 
                        : "bg-slate-100/40 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 hover:dark:border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">INV-#{order.id}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-end mt-3">
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide leading-none">Processed by</p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">{order.staff?.fullName || "Owner"}</p>
                      </div>
                      <p className="text-sm font-bold text-blue-400">₦{Number(order.calculatedTotal).toLocaleString()}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

              {/* RIGHT COLUMN: Print-Ready Sheet Canvas */}
              <div className="lg:col-span-2 print:w-full">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 p-3 rounded-xl print:hidden">
                <span className="text-xs text-slate-500">Viewing invoice details</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendInvoiceViaWhatsApp(selectedOrder)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold transition-all"
                  >
                    <MessageCircle size={13} /> Send via WhatsApp
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 border border-slate-300/60 dark:border-slate-700/60 text-xs text-[var(--text-primary)] font-semibold transition-all"
                  >
                    <Printer size={13} /> Print / Export PDF
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl print:border-none print:bg-transparent print:p-0 text-slate-700 dark:text-slate-300">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">
                      {selectedOrder.owner?.storeName || "Garrison Market"}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Merchant Statement Summary</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 font-medium">{selectedOrder.owner?.fullName}</p>
                    <p className="text-[11px] text-slate-500">{selectedOrder.owner?.email}</p>
                  </div>
                  <div className="sm:text-right">
                    <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-3">
                      Paid Statement
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">INVOICE NO: #{selectedOrder.id}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Date: {new Date(selectedOrder.date).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="py-4 bg-slate-50/40 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl px-4 mt-6 grid grid-cols-2 gap-4 print:bg-transparent print:border-slate-700 print:dark:border-slate-300">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Authorized Merchant</p>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{merchantName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sales Register Clerk</p>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                      {selectedOrder.staff?.fullName || "Owner Account"}
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Itemized Products Breakdown</h3>
                  <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/20 print:border-slate-700 print:dark:border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 print:border-slate-700 print:dark:border-slate-300">
                          <th className="p-3 font-semibold">Product Name</th>
                          <th className="p-3 font-semibold text-center w-16">Qty</th>
                          <th className="p-3 font-semibold text-right w-28">Unit Price</th>
                          <th className="p-3 font-semibold text-right w-32">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 print:divide-slate-300">
                        {selectedOrder.items.map((item: OrderItemType) => { 
                          const subValue = Number(item.priceAtTime) * item.quantity;
                          return (
                            <tr key={item.id} className="hover:bg-slate-100/10 hover:dark:bg-slate-900/10 transition-colors">
                              <td className="p-3 font-medium text-[var(--text-primary)]">{item.inventory?.name || "Deleted Product"}</td>
                              <td className="p-3 text-center text-slate-600 dark:text-slate-400">{item.quantity}</td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400">₦{Number(item.priceAtTime).toLocaleString()}</td>
                              <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">₦{subValue.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mathematical Totals Panel block — NOW USES calculatedTotal */}
                <div className="mt-6 flex justify-end">
                  <div className="w-full sm:w-72 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-4 print:border-slate-700 print:dark:border-slate-300">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Gross Subtotal</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">₦{Number(selectedOrder.calculatedTotal).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Applied Surcharges</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">₦0.00</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-800 border-dashed items-center print:border-slate-700 print:dark:border-slate-300">
                      <span className="font-bold text-[var(--text-primary)]">Amount Settled</span>
                      <span className="text-base font-black text-blue-400 print:text-black">
                        ₦{Number(selectedOrder.calculatedTotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Professional Print Terms Declaration Notice footer */}
                <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-[10px] text-slate-500 space-y-1 print:border-slate-700 print:dark:border-slate-300">
                  <p className="font-medium">Thank you for transacting with {selectedOrder.owner?.storeName || "us"}!</p>
                  <p>System-generated official accounting records. Certificate credentials verified.</p>
                </div>

              </div>
            </div>
          ) : (
            <div className="p-16 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/10 dark:bg-slate-900/10">
              <p className="text-slate-500 text-sm">No transactions found to display details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}