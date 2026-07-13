"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Printer, Receipt, ChevronLeft } from "lucide-react";

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
  staff: { fullName: string | null } | null;
  owner: { storeName: string | null; fullName: string | null; email: string } | null;
  items: OrderItemType[];
}

export default function StaffInvoicesPage() {
  const router = useRouter();
  const [todaysOrders, setTodaysOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantName, setMerchantName] = useState("Store Owner");

  useEffect(() => {
    async function fetchTodaysInvoices() {
      try {
        const res = await fetch("/api/invoices");
        if (res.ok) {
          const payload = await res.json();
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const filtered = (payload.orders as OrderType[]).filter((order) => {
            return new Date(order.date) >= startOfToday;
          });

          setTodaysOrders(filtered);
          if (payload.merchantName) setMerchantName(payload.merchantName);
        }
      } catch (err) {
        console.error("Failed to query records:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTodaysInvoices();
  }, []);

  const activeOrder = todaysOrders.length > 0 ? todaysOrders[todaysOrders.length - 1] : null;

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 p-4 sm:p-8 print:p-0">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 print:hidden">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs text-white font-semibold transition-all"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm mt-12">Loading transactions...</div>
        ) : activeOrder ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900/30 border border-slate-800/60 p-3 rounded-xl print:hidden">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift Log ({todaysOrders.length} today)
              </span>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs text-white font-semibold transition-all"
              >
                <Printer size={13} /> Print
              </button>
            </div>
            {/* ... Rest of your render logic ... */}
          </div>
        ) : (
          <div className="p-16 text-center border border-slate-800 rounded-2xl bg-slate-900/10">
            <Receipt size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No transactions registered today.</p>
          </div>
        )}
      </div>
    </div>
  );
}