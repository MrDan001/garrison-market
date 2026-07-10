"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Plus, Home, BarChart3, ReceiptText, User, Edit2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface InventoryItem {
  id: number | string;
  name: string;
  quantity: number;
  price: number;
  costPrice: number | null;
  category: string | null;
  restockLevel: number | null;
  image: string | null;
}

type Tab = "all" | "in-stock" | "out-of-stock";

export default function InventoryGrid({ items }: { items: InventoryItem[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const statusMessages: Record<string, string> = {
    added: "Item added successfully.",
    updated: "Changes saved successfully.",
    deleted: "Item deleted successfully.",
    archived: "Item had sales history, so it was marked Out of Stock instead of deleted.",
  };
  const [banner, setBanner] = useState<string | null>(status ? statusMessages[status] || null : null);

  useEffect(() => {
    if (!status) return;
    // Clear the query param from the URL after showing the banner, and
    // auto-dismiss it after a few seconds.
    router.replace("/owner/inventory", { scroll: false });
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const outOfStockItems = items.filter((i) => i.quantity <= 0);
  const inStockItems = items.filter((i) => i.quantity > 0);

  const visibleItems = tab === "in-stock" ? inStockItems : tab === "out-of-stock" ? outOfStockItems : items;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "in-stock", label: "In Stock", count: inStockItems.length },
    { key: "out-of-stock", label: "Out of Stock", count: outOfStockItems.length },
  ];

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 pb-24">
      {banner && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 text-xs font-medium px-4 py-2.5 flex items-center gap-2 sticky top-0 z-30">
          <CheckCircle2 size={14} />
          {banner}
        </div>
      )}
      <div className="sticky top-0 z-20 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">Inventory</h1>
          <Link href="/owner/inventory/add" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-semibold">
            <Plus size={13} /> Add Item
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-[#1a1d24] text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {t.label} <span className="opacity-60">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 max-w-5xl mx-auto">
        {visibleItems.map((item) => {
          const isOutOfStock = item.quantity <= 0;
          const isLowStock = !isOutOfStock && item.restockLevel != null && item.quantity <= item.restockLevel;
          const margin = item.costPrice != null ? item.price - item.costPrice : null;

          return (
            <Link
              key={item.id}
              href={`/owner/inventory/${item.id}/edit`}
              className="bg-[#1a1d24] rounded-2xl overflow-hidden border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col relative group"
            >
              <div className="aspect-square bg-slate-950 relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-700">
                    <Package size={40} />
                  </div>
                )}

                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                      Out of Stock
                    </span>
                  </div>
                )}

                {isLowStock && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                      Low Stock
                    </span>
                  </div>
                )}

                {item.category && (
                  <div className="absolute bottom-2 left-2 z-10">
                    <span className="bg-slate-900/80 backdrop-blur text-slate-300 border border-slate-700 text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md">
                      {item.category}
                    </span>
                  </div>
                )}

                <div className="absolute top-2 right-2 p-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Edit2 size={12} className="text-blue-400" />
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                <h2 className="font-semibold text-sm truncate text-white">{item.name}</h2>

                <div className="flex justify-between items-center">
                  <p className={`text-xs ${isOutOfStock ? "text-rose-400 font-medium" : isLowStock ? "text-amber-400 font-medium" : "text-slate-400"}`}>
                    Qty: {item.quantity}
                  </p>
                  <p className="text-xs font-bold text-blue-400">₦{item.price.toLocaleString()}</p>
                </div>

                {item.costPrice != null && (
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span>Cost: ₦{item.costPrice.toLocaleString()}</span>
                    {margin != null && (
                      <span className={margin >= 0 ? "text-emerald-500" : "text-rose-400"}>
                        {margin >= 0 ? "+" : ""}₦{margin.toLocaleString()} margin
                      </span>
                    )}
                  </div>
                )}

                {item.restockLevel != null && (
                  <p className="text-[10px] text-slate-600">Restock at: {item.restockLevel}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {visibleItems.length === 0 && (
        <div className="text-center mt-20 text-slate-500 px-6">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>
            {tab === "out-of-stock"
              ? "No out-of-stock items right now."
              : tab === "in-stock"
              ? "No in-stock items yet."
              : "No inventory items found. Add your first product to get started."}
          </p>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A0C10]/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 pb-2 z-50 md:hidden">
        <Link href="/owner/dashboard" className="flex flex-col items-center gap-1 text-slate-500">
          <Home size={22} />
          <span className="text-[10px]">Home</span>
        </Link>
        <Link href="/owner/report" className="flex flex-col items-center gap-1 text-slate-500">
          <BarChart3 size={22} />
          <span className="text-[10px]">Stats</span>
        </Link>

        <Link href="/owner/inventory" className="flex flex-col items-center justify-center -mt-10">
          <div className="bg-blue-500 p-4 rounded-full shadow-lg shadow-blue-500/20 border-4 border-[#0A0C10]">
            <Package size={28} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-blue-400 mt-1">Inventory</span>
        </Link>

        <Link href="/owner/orders" className="flex flex-col items-center gap-1 text-slate-500">
          <ReceiptText size={22} />
          <span className="text-[10px]">Orders</span>
        </Link>
        <Link href="/owner/profile" className="flex flex-col items-center gap-1 text-slate-500">
          <User size={22} />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
